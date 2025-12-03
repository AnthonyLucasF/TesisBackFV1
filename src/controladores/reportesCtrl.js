import { conmysql } from "../db.js";

export const getReporte = async (req, res) => {
  try {
    const { tipo } = req.params;

    let titulo = "";
    let data = [];
    let kpi = {};

    // 1) RENDIMIENTO
    if (tipo === "rendimiento") {
      titulo = "Rendimiento por Proceso";

      const [rows] = await conmysql.query(`
        SELECT 
          l.lote_codigo AS label,
          CAST(liq.liquidacion_rendimiento AS DECIMAL(10,2)) AS valor
        FROM liquidacion liq
        LEFT JOIN lote l ON l.lote_id = liq.lote_id
        ORDER BY l.lote_id DESC
        LIMIT 20
      `);

      data = rows.map(x => ({
        label: x.label,
        valor: parseFloat(x.valor) || 0
      }));

      const total = data.reduce((s,x)=>s+x.valor,0);

      kpi = {
        total,
        promedio: total / (data.length || 1),
        mejor: data.sort((a,b)=>b.valor - a.valor)[0]?.label
      };
    }


    // 2) PERDIDAS
    if (tipo === "perdidas") {
      titulo = "Pérdidas por Lote";

      const [rows] = await conmysql.query(`
        SELECT 
          l.lote_codigo AS label,
          CAST(liq.liquidacion_basura + liq.liquidacion_sobrante AS DECIMAL(10,2)) AS valor
        FROM liquidacion liq
        LEFT JOIN lote l ON l.lote_id = liq.lote_id
      `);

      data = rows.map(x => ({
        label: x.label,
        valor: parseFloat(x.valor) || 0
      }));

      const total = data.reduce((s,x)=>s+x.valor,0);

      kpi = {
        total,
        promedio: total/(data.length||1)
      };
    }


    // 3) PRODUCCION
    if (tipo === "produccion") {
      titulo = "Producción de Cajas por Lote";

      const [rows] = await conmysql.query(`
        SELECT 
          l.lote_codigo AS label,
          SUM(it.ingresotunel_n_cajas) AS valor
        FROM ingresotunel it
        LEFT JOIN lote l ON l.lote_id = it.lote_id
        GROUP BY it.lote_id
      `);

      data = rows.map(x => ({
        label: x.label,
        valor: parseFloat(x.valor) || 0
      }));

      kpi = {
        total: data.reduce((s,x)=>s+x.valor,0)
      };
    }


    // 4) CALIDAD
    if (tipo === "calidad") {
      titulo = "Defectos por Lote";

      const [rows] = await conmysql.query(`
        SELECT 
          l.lote_codigo AS label,
          CAST(d.defectos_total_defectos AS DECIMAL(10,2)) AS valor
        FROM control_calidad cc
        LEFT JOIN lote l ON l.lote_id = cc.lote_id
        LEFT JOIN defectos d ON d.defectos_id = cc.defectos_id
      `);

      data = rows.map(x => ({
        label: x.label,
        valor: parseFloat(x.valor) || 0
      }));

      kpi = {
        total: data.reduce((s,x)=>s+x.valor,0)
      };
    }


    // 5) PROVEEDORES
    if (tipo === "proveedores") {
      titulo = "Ranking de Proveedores";

      const [rows] = await conmysql.query(`
        SELECT 
          pr.proveedor_nombre AS label,
          SUM(l.lote_libras_remitidas) AS valor
        FROM lote l
        LEFT JOIN proveedor pr ON pr.proveedor_id = l.proveedor_id
        GROUP BY pr.proveedor_id
        ORDER BY valor DESC
      `);

      data = rows.map(x => ({
        label: x.label,
        valor: parseFloat(x.valor) || 0
      }));

      kpi = {
        total: data.reduce((s,x)=>s+x.valor,0),
        mejor: data[0]?.label
      };
    }

    // RESPUESTA FINAL
    return res.json({ titulo, data, kpi });

  } catch (err) {
    console.error("Error Reportes:", err);
    res.status(500).json({ message: err.message });
  }
};
