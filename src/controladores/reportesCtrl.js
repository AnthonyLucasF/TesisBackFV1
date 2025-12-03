// src/controladores/reportesCtrl.js
import { conmysql } from "../db.js";

export const getReporte = async (req, res) => {
  try {
    const { tipo } = req.params;

    let titulo = "";
    let data = [];
    let kpi = {};

    // ================================
    // 1. RENDIMIENTO POR PROCESO
    // ================================
    if (tipo === "rendimiento") {

      titulo = "Rendimiento por Proceso";

      const [rows] = await conmysql.query(`
        SELECT 
          l.lote_codigo AS label,
          liq.liquidacion_rendimiento AS valor
        FROM liquidacion liq
        LEFT JOIN lote l ON l.lote_id = liq.lote_id
        ORDER BY l.lote_id DESC
        LIMIT 20
      `);

      data = rows;

      const total = rows.reduce((s, x) => s + Number(x.valor), 0);
      kpi = {
        total,
        promedio: total / (rows.length || 1),
        mejor: rows.sort((a, b) => b.valor - a.valor)[0]?.label
      };
    }

    // =====================================
    // 2. PROMEDIO DE PÉRDIDAS (BASURA + SOBRANTE)
    // =====================================
    if (tipo === "perdidas") {
      titulo = "Pérdidas por Lote";

      const [rows] = await conmysql.query(`
        SELECT 
          l.lote_codigo AS label,
          (liq.liquidacion_basura + liq.liquidacion_sobrante) AS valor
        FROM liquidacion liq
        LEFT JOIN lote l ON l.lote_id = liq.lote_id
      `);

      data = rows;

      const total = rows.reduce((s, x) => s + Number(x.valor), 0);
      kpi = {
        total,
        promedio: total / (rows.length || 1)
      };
    }

    // ============================
    // 3. PRODUCCIÓN TOTAL (CAJAS)
    // ============================
    if (tipo === "produccion") {
      titulo = "Producción de Cajas por Lote";

      const [rows] = await conmysql.query(`
        SELECT 
          l.lote_codigo AS label,
          SUM(it.ingresotunel_cajas) AS valor
        FROM ingresotunel it
        LEFT JOIN lote l ON l.lote_id = it.lote_id
        GROUP BY it.lote_id
      `);

      data = rows;
      kpi = {
        total: rows.reduce((s, x) => s + x.valor, 0)
      };
    }

    // ============================
    // 4. DEFECTOS DE CALIDAD
    // ============================
    if (tipo === "calidad") {
      titulo = "Defectos por Lote";

      const [rows] = await conmysql.query(`
        SELECT 
          l.lote_codigo AS label,
          d.defectos_total_defectos AS valor
        FROM control_calidad cc
        LEFT JOIN lote l ON l.lote_id = cc.lote_id
        LEFT JOIN defectos d ON d.defectos_id = cc.defectos_id
      `);

      data = rows;
      kpi = {
        total: rows.reduce((s, x) => s + Number(x.valor), 0)
      };
    }

    // ============================
    // 5. RANKING PROVEEDORES
    // ============================
    if (tipo === "proveedores") {
      titulo = "Ranking de Proveedores por Libras Entregadas";

      const [rows] = await conmysql.query(`
        SELECT 
          pr.proveedor_nombre AS label,
          SUM(l.lote_libras_remitidas) AS valor
        FROM lote l
        LEFT JOIN proveedor pr ON pr.proveedor_id = l.proveedor_id
        GROUP BY pr.proveedor_id
        ORDER BY valor DESC
      `);

      data = rows;

      kpi = {
        total: rows.reduce((s, x) => s + x.valor, 0),
        mejor: rows[0]?.label
      };
    }

    return res.json({ titulo, data, kpi });

  } catch (err) {
    console.error("Error Reportes:", err);
    res.status(500).json({ message: err.message });
  }
};
