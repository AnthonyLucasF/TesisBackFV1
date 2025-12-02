import { conmysql } from "../db.js";

export const getHistorialLoteBase = async (lote_id, res) => {
  try {
    // 1) DATOS GENERALES
    const [lote] = await conmysql.query(`
      SELECT 
        l.*, 
        p.proveedor_nombre,
        c.chofer_nombre,
        v.vehiculo_placa,
        t.tipo_descripcion,
        cl.clase_descripcion,
        co.color_descripcion
      FROM lote l
      LEFT JOIN proveedor p ON l.proveedor_id = p.proveedor_id
      LEFT JOIN chofer c ON l.chofer_id = c.chofer_id
      LEFT JOIN vehiculo v ON l.vehiculo_id = v.vehiculo_id
      LEFT JOIN tipo t ON l.tipo_id = t.tipo_id
      LEFT JOIN clase cl ON l.clase_id = cl.clase_id
      LEFT JOIN color co ON l.color_id = co.color_id
      WHERE l.lote_id = ?
    `, [lote_id]);

    if (!lote.length) {
      return res.status(404).json({ message: "Lote no encontrado" });
    }

    // 2) CALIDAD
    const [calidad] = await conmysql.query(`
      SELECT cc.*, u.usuario_nombre 
      FROM control_calidad cc
      LEFT JOIN usuario u ON cc.usuario_id = u.usuario_id
      WHERE cc.lote_id = ?
      ORDER BY cc.c_calidad_id ASC
    `, [lote_id]);

    // 3) CLASIFICACIÓN
    const [clasificacion] = await conmysql.query(`
      SELECT c.*, 
        t.tipo_descripcion,
        cl.clase_descripcion,
        co.color_descripcion,
        ta.talla_descripcion,
        p.peso_descripcion,
        pr.presentacion_descripcion,
        u.usuario_nombre
      FROM clasificacion c
      LEFT JOIN tipo t ON c.tipo_id = t.tipo_id
      LEFT JOIN clase cl ON c.clase_id = cl.clase_id
      LEFT JOIN color co ON c.color_id = co.color_id
      LEFT JOIN talla ta ON c.talla_id = ta.talla_id
      LEFT JOIN peso p ON c.peso_id = p.peso_id
      LEFT JOIN presentacion pr ON c.presentacion_id = pr.presentacion_id
      LEFT JOIN usuario u ON c.usuario_id = u.usuario_id
      WHERE c.lote_id = ?
      ORDER BY c.clasificacion_id ASC
    `, [lote_id]);

    // 4) DESCABEZADO
    const [descabezado] = await conmysql.query(`
      SELECT d.*, u.usuario_nombre 
      FROM descabezado d
      LEFT JOIN usuario u ON d.usuario_id = u.usuario_id
      WHERE d.lote_id = ?
      ORDER BY d.descabezado_id ASC
    `, [lote_id]);

    // 5) PELADO
    const [pelado] = await conmysql.query(`
      SELECT p.*, u.usuario_nombre 
      FROM pelado p
      LEFT JOIN usuario u ON p.usuario_id = u.usuario_id
      WHERE p.lote_id = ?
      ORDER BY p.pelado_id ASC
    `, [lote_id]);

    // 6) INGRESO TÚNEL
    const [ingreso_tunel] = await conmysql.query(`
      SELECT it.*, pr.presentacion_descripcion, pe.peso_descripcion 
      FROM ingresotunel it
      LEFT JOIN presentacion pr ON it.presentacion_id = pr.presentacion_id
      LEFT JOIN peso pe ON it.peso_id = pe.peso_id
      WHERE it.lote_id = ?
      ORDER BY it.ingresotunel_id ASC
    `, [lote_id]);

    // 7) MASTERIZADO
    const [masterizado] = await conmysql.query(`
      SELECT m.*, c.coche_descripcion, u.usuario_nombre
      FROM masterizado m
      LEFT JOIN coche c ON m.coche_id = c.coche_id
      LEFT JOIN usuario u ON m.usuario_id = u.usuario_id
      WHERE m.lote_id = ?
      ORDER BY m.masterizado_id ASC
    `, [lote_id]);

    // 8) LIQUIDACIONES
    const [liquidaciones] = await conmysql.query(`
      SELECT * FROM liquidacion 
      WHERE lote_id = ?
      ORDER BY liquidacion_id ASC
    `, [lote_id]);

    // 9) DETALLES DE LIQUIDACIÓN
    const [detalle_liquidacion] = await conmysql.query(`
      SELECT * FROM liquidacion_detalle 
      WHERE liquidacion_id IN (
        SELECT liquidacion_id FROM liquidacion WHERE lote_id = ?
      )
      ORDER BY detalle_id ASC
    `, [lote_id]);

    // 10) AUDITORÍA
    const [auditoria] = await conmysql.query(`
      SELECT a.*, u.usuario_nombre 
      FROM auditoria a
      LEFT JOIN usuario u ON a.usuario_id = u.usuario_id
      WHERE a.auditoria_detalle LIKE ?
      ORDER BY a.auditoria_id ASC
    `, [`%Lote ID: ${lote_id}%`]);

    // 11) HISTORIAL JSON
    let historial_json = {};
    try {
      historial_json = JSON.parse(lote[0].lote_historial || "{}");
    } catch {
      historial_json = {};
    }

    res.json({
      lote: lote[0],
      calidad,
      clasificacion,
      descabezado,
      pelado,
      ingreso_tunel,
      masterizado,
      liquidaciones,
      liquidacion_detalle,
      auditoria,
      historial_json
    });

  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ message: "Error al obtener historial", error: error.message });
  }
};

export const getHistorialPorCodigo = async (req, res) => {
  try {
    const { codigo } = req.params;

    const [lote] = await conmysql.query(
      `SELECT * FROM lote WHERE lote_codigo = ?`,
      [codigo]
    );

    if (!lote.length) {
      return res.status(404).json({ message: "Código no encontrado" });
    }

    // Reutilizamos getHistorialLote usando el lote_id encontrado
    req.params.lote_id = lote[0].lote_id;
    return getHistorialLote(req, res);

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error al buscar lote por código" });
  }
};

