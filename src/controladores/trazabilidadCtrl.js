// src/controladores/trazabilidadCtrl.js
import { conmysql } from "../db.js";

// GET /trazabilidad/:lote_id  -> Historial completo del lote
export const getHistorialLote = async (req, res) => {
  try {
    const { lote_id } = req.params;

    // 1. Datos generales del lote
    const [lote] = await conmysql.query(`
      SELECT 
        l.lote_id, l.lote_codigo, l.lote_tipo, l.lote_fecha_ingreso, 
        l.lote_hora_ingreso, l.lote_libras_remitidas, l.lote_peso_promedio,
        t.tipo_descripcion, c.color_descripcion, cls.clase_descripcion,
        p.proveedor_nombre
      FROM lote l
      LEFT JOIN tipo t ON l.tipo_id = t.tipo_id
      LEFT JOIN color c ON l.color_id = c.color_id
      LEFT JOIN clase cls ON l.clase_id = cls.clase_id
      LEFT JOIN proveedor p ON l.proveedor_id = p.proveedor_id
      WHERE l.lote_id = ?
    `, [lote_id]);

    if (lote.length === 0) {
      return res.status(404).json({ message: "Lote no encontrado" });
    }

    // 2. Control de calidad
    const [calidad] = await conmysql.query(`
      SELECT * FROM control_calidad 
      WHERE lote_id = ? ORDER BY c_calidad_id ASC
    `, [lote_id]);

    // 3. Descabezado
    const [descabezado] = await conmysql.query(`
      SELECT * FROM descabezado 
      WHERE lote_id = ? ORDER BY descabezado_id ASC
    `, [lote_id]);

    // 4. Pelado
    const [pelado] = await conmysql.query(`
      SELECT * FROM pelado 
      WHERE lote_id = ? ORDER BY pelado_id ASC
    `, [lote_id]);

    // 5. Clasificación
    const [clasificacion] = await conmysql.query(`
      SELECT * FROM clasificacion 
      WHERE lote_id = ? ORDER BY clasificacion_id ASC
    `, [lote_id]);

    // 6. Ingreso a túnel
    const [ingresosTunel] = await conmysql.query(`
      SELECT * FROM ingresotunel 
      WHERE lote_id = ? ORDER BY ingresotunel_id ASC
    `, [lote_id]);

    // 7. Liquidaciones (entero y cola)
    const [liquidaciones] = await conmysql.query(`
      SELECT * FROM liquidacion 
      WHERE lote_id = ? ORDER BY liquidacion_id ASC
    `, [lote_id]);

    // 8. Masterizado
    const [masterizado] = await conmysql.query(`
      SELECT * FROM masterizado 
      WHERE lote_id = ? ORDER BY masterizado_id ASC
    `, [lote_id]);

    // Unimos todo en un solo objeto
    res.json({
      info_lote: lote[0],
      calidad,
      descabezado,
      pelado,
      clasificacion,
      ingresosTunel,
      liquidaciones,
      masterizado
    });

  } catch (error) {
    console.error("Error getHistorialLote:", error);
    res.status(500).json({ message: "Error al obtener historial del lote", error: error.message });
  }
};
