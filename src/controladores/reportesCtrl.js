// src/controladores/reportesCtrl.js
import { conmysql } from "../db.js";

export const getReporte = async (req, res) => {
  try {
    const { tipo } = req.params;

    let titulo = "";
    let query = "";
    let kpi = {};

    switch (tipo) {

      // 1) PRODUCCIÓN: libras netas por lote (túnel)
      case "produccion":
        titulo = "Producción (Libras Netas por Lote)";

        query = `
          SELECT 
            l.lote_codigo AS label,
            SUM(it.ingresotunel_libras_netas) AS valor
          FROM ingresotunel it
          LEFT JOIN lote l ON l.lote_id = it.lote_id
          GROUP BY it.lote_id
          ORDER BY valor DESC
        `;

        {
          const [rowsKpi] = await conmysql.query(`
            SELECT 
              COUNT(DISTINCT lote_id) AS lotes,
              SUM(ingresotunel_libras_netas) AS total_libras,
              SUM(ingresotunel_n_cajas) AS total_cajas
            FROM ingresotunel
          `);
          kpi = rowsKpi[0] || {};
        }
        break;

      // 2) PERDIDAS: basura + sobrante en túnel
      case "perdidas":
        titulo = "Pérdidas (Basura + Sobrante por Lote)";

        query = `
          SELECT
            l.lote_codigo AS label,
            SUM(it.ingresotunel_basura + it.ingresotunel_sobrante) AS valor
          FROM ingresotunel it
          LEFT JOIN lote l ON l.lote_id = it.lote_id
          GROUP BY it.lote_id
          ORDER BY valor DESC
        `;

        {
          const [rowsKpi] = await conmysql.query(`
            SELECT 
              SUM(ingresotunel_basura)   AS basura_total,
              SUM(ingresotunel_sobrante) AS sobrante_total
            FROM ingresotunel
          `);
          kpi = rowsKpi[0] || {};
        }
        break;

      // 3) RENDIMIENTO: rendimiento promedio por lote
      case "rendimiento":
        titulo = "Rendimiento Promedio por Lote";

        query = `
          SELECT 
            l.lote_codigo AS label,
            AVG(it.ingresotunel_rendimiento) AS valor
          FROM ingresotunel it
          LEFT JOIN lote l ON l.lote_id = it.lote_id
          GROUP BY it.lote_id
          ORDER BY valor DESC
        `;

        {
          const [rowsKpi] = await conmysql.query(`
            SELECT 
              AVG(ingresotunel_rendimiento) AS prom_rendimiento,
              MIN(ingresotunel_rendimiento) AS min_rendimiento,
              MAX(ingresotunel_rendimiento) AS max_rendimiento
            FROM ingresotunel
            WHERE ingresotunel_rendimiento IS NOT NULL
          `);
          kpi = rowsKpi[0] || {};
        }
        break;

      // 4) CALIDAD: defectos totales promedio por lote
      case "calidad":
        titulo = "Control de Calidad y Defectos por Lote";

        query = `
          SELECT 
            l.lote_codigo AS label,
            AVG(d.defectos_total_defectos) AS valor
          FROM control_calidad cc
          LEFT JOIN lote l     ON l.lote_id = cc.lote_id
          LEFT JOIN defectos d ON d.defectos_id = cc.defectos_id
          GROUP BY cc.lote_id
          ORDER BY valor DESC
        `;

        {
          const [rowsKpi] = await conmysql.query(`
            SELECT 
              AVG(d.defectos_total_defectos) AS prom_total_defectos,
              MAX(d.defectos_total_defectos) AS max_total_defectos,
              MIN(d.defectos_total_defectos) AS min_total_defectos
            FROM control_calidad cc
            LEFT JOIN defectos d ON d.defectos_id = cc.defectos_id
          `);
          kpi = rowsKpi[0] || {};
        }
        break;

      // 5) PROVEEDORES: ranking por libras netas ingresadas a túnel
      case "proveedores":
        titulo = "Ranking de Proveedores (Libras Netas)";

        query = `
          SELECT 
            pr.proveedor_nombre AS label,
            SUM(it.ingresotunel_libras_netas) AS valor
          FROM ingresotunel it
          LEFT JOIN lote l ON l.lote_id = it.lote_id
          LEFT JOIN proveedor pr ON pr.proveedor_id = l.proveedor_id
          GROUP BY pr.proveedor_id
          ORDER BY valor DESC
        `;

        {
          const [rowsKpi] = await conmysql.query(`
            SELECT 
              COUNT(DISTINCT pr.proveedor_id) AS total_proveedores,
              SUM(it.ingresotunel_libras_netas) AS total_libras
            FROM ingresotunel it
            LEFT JOIN lote l ON l.lote_id = it.lote_id
            LEFT JOIN proveedor pr ON pr.proveedor_id = l.proveedor_id
          `);
          kpi = rowsKpi[0] || {};
        }
        break;

      default:
        return res.status(400).json({ message: "Tipo de reporte inválido" });
    }

    const [rows] = await conmysql.query(query);

    res.json({
      titulo,
      kpi,
      data: rows
    });

  } catch (err) {
    console.error("Error Reportes:", err);
    res.status(500).json({ message: err.message });
  }
};
