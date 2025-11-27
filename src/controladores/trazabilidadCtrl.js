// src/controladores/trazabilidadCtrl.js
import { conmysql } from "../db.js";

export const getHistorialLote = async (req, res) => {
  try {
    const { query } = req.query;  // Código o ID
    let lote_id;
    if (isNaN(query)) {  // Si código, fetch ID
      const [lote] = await conmysql.query('SELECT lote_id FROM lote WHERE lote_codigo = ?', [query]);
      if (lote.length === 0) return res.status(404).json({ message: "Lote no encontrado" });
      lote_id = lote[0].lote_id;
    } else {
      lote_id = parseInt(query);
    }

    const [result] = await conmysql.query(`
      SELECT 
        l.lote_id, l.lote_codigo, l.lote_fecha, l.lote_libras_remitidas, p.proveedor_nombre,
        cc.calidad_estado, cc.calidad_uniformidad,
        GROUP_CONCAT(JSON_OBJECT('ingresotunel_id', it.ingresotunel_id, 'fecha', it.ingresotunel_fecha, 'total', it.ingresotunel_total, 'rendimiento', it.ingresotunel_rendimiento)) as ingresos,
        AVG(it.ingresotunel_rendimiento) as avg_rendimiento_ingreso,
        (SELECT COUNT(*) FROM descabezado des WHERE des.lote_id = l.lote_id) as descabezados_count,
        (SELECT COUNT(*) FROM pelado pel WHERE pel.lote_id = l.lote_id) as pelados_count,
        m.masterizado_total_libras, m.masterizado_total_master,
        li.rendimiento_final
      FROM lote l
      LEFT JOIN proveedor p ON l.proveedor_id = p.proveedor_id
      LEFT JOIN control_calidad cc ON l.lote_id = cc.lote_id
      LEFT JOIN defectos def ON l.lote_id = def.lote_id
      LEFT JOIN ingresotunel it ON l.lote_id = it.lote_id
      LEFT JOIN masterizado m ON l.lote_id = m.lote_id
      LEFT JOIN liquidacion li ON l.lote_id = li.lote_id
      WHERE l.lote_id = ?
      GROUP BY l.lote_id
    `, [lote_id]);

    if (result.length === 0) return res.status(404).json({ message: "Historial no encontrado" });
    result[0].ingresos = JSON.parse(`[${result[0].ingresos || ''}]`);  // Parse array
    res.json(result[0]);
  } catch (error) {
    res.status(500).json({ message: "Error al consultar historial", error });
  }
};