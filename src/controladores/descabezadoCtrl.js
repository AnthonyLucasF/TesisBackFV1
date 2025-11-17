// src/controladores/descabezadoCtrl.js
import { conmysql } from "../db.js";

// GET: Obtener todos los descabezados con JOINs, ordenados por fecha descendente
export const getDescabezado = async (req, res) => {
  try {
    const [result] = await conmysql.query(`
      SELECT d.*, l.lote_codigo, u.usuario_nombre, o.orden_codigo, ch.coche_descripcion
      FROM descabezado d
      LEFT JOIN lote l ON d.lote_id = l.lote_id
      LEFT JOIN usuario u ON d.usuario_id = u.usuario_id
      LEFT JOIN orden o ON d.orden_id = o.orden_id
      LEFT JOIN coche ch ON d.coche_id = ch.coche_id
      ORDER BY d.descabezado_fecha DESC
    `);
    res.json(result);
  } catch (error) {
    return res.status(500).json({ message: "Error al consultar Descabezado" });
  }
};

// GET por ID con JOINs
export const getDescabezadoxid = async (req, res) => {
  try {
    const [result] = await conmysql.query(`
      SELECT d.*, l.lote_codigo, u.usuario_nombre, o.orden_codigo, ch.coche_descripcion
      FROM descabezado d
      LEFT JOIN lote l ON d.lote_id = l.lote_id
      LEFT JOIN usuario u ON d.usuario_id = u.usuario_id
      LEFT JOIN orden o ON d.orden_id = o.orden_id
      LEFT JOIN coche ch ON d.coche_id = ch.coche_id
      WHERE d.descabezado_id = ?
    `, [req.params.id]);
    if (result.length <= 0) return res.status(404).json({ descabezado_id: 0, message: "Descabezado no encontrado" });
    res.json(result[0]);
  } catch (error) {
    return res.status(500).json({ message: "Error del Servidor" });
  }
};

// POST: Registrar descabezado, calcular rendimiento, crear sublote si necesario, emitir WS
export const postDescabezado = async (req, res) => {
  try {
    const { usuario_id, lote_id, orden_id, coche_id, descabezado_libras_descabezadas, descabezado_basura, descabezado_observaciones } = req.body;

    if (!lote_id || !orden_id || !coche_id) return res.status(400).json({ message: "lote_id, orden_id y coche_id son requeridos" });

    // Obtener promedio del lote
    const [lote] = await conmysql.query('SELECT lote_libras_remitidas FROM lote WHERE lote_id = ?', [lote_id]);
    const librasRemitidas = lote[0].lote_libras_remitidas || 0;

    // Calcular rendimiento
    const descabezado_rendimiento = librasRemitidas > 0 ? ((descabezado_libras_descabezadas - descabezado_basura) / librasRemitidas * 100).toFixed(2) : 0;

    // Fecha actual
    const descabezado_fecha = new Date().toISOString().slice(0, 19).replace('T', ' ');

    // Insertar descabezado
    const [insertResult] = await conmysql.query(
      'INSERT INTO descabezado (usuario_id, lote_id, orden_id, coche_id, descabezado_fecha, descabezado_libras_descabezadas, descabezado_basura, descabezado_rendimiento, descabezado_observaciones) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [usuario_id, lote_id, orden_id, coche_id, descabezado_fecha, descabezado_libras_descabezadas, descabezado_basura, descabezado_rendimiento, descabezado_observaciones]
    );

    const nuevoId = insertResult.insertId;

    // Crear sublote para cola (parent_lote_id = lote_id actual)
    const subloteCodigo = `SUB-${lote[0].lote_codigo}-COLA`; // Ejemplo de código para sublote
    await conmysql.query(
      'INSERT INTO lote (lote_codigo, parent_lote_id, lote_libras_remitidas, lote_peso_promedio /* otros campos */) VALUES (?, ?, ?, ? /* valores */)',
      [subloteCodigo, lote_id, descabezado_libras_descabezadas, descabezado_libras_descabezadas /* ajustar */]
    );

    // Obtener registro completo
    const [nuevo] = await conmysql.query(`
      SELECT d.*, l.lote_codigo, u.usuario_nombre, o.orden_codigo, ch.coche_descripcion
      FROM descabezado d
      LEFT JOIN lote l ON d.lote_id = l.lote_id
      LEFT JOIN usuario u ON d.usuario_id = u.usuario_id
      LEFT JOIN orden o ON d.orden_id = o.orden_id
      LEFT JOIN coche ch ON d.coche_id = ch.coche_id
      WHERE d.descabezado_id = ?
    `, [nuevoId]);

    // Emitir WebSocket
    global._io.emit("descabezado_nuevo", nuevo[0]);

    res.json(nuevo[0]);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// PUT: Actualizar descabezado completo, recalcular rendimiento, emitir WS
export const putDescabezado = async (req, res) => {
  try {
    const { id } = req.params;
    const { usuario_id, lote_id, orden_id, coche_id, descabezado_libras_descabezadas, descabezado_basura, descabezado_observaciones } = req.body;

    // Obtener promedio
    const [lote] = await conmysql.query('SELECT lote_libras_remitidas FROM lote WHERE lote_id = ?', [lote_id]);
    const librasRemitidas = lote[0].lote_libras_remitidas || 0;

    // Recalcular rendimiento
    const descabezado_rendimiento = librasRemitidas > 0 ? ((descabezado_libras_descabezadas - descabezado_basura) / librasRemitidas * 100).toFixed(2) : 0;

    // Actualizar
    const [updateResult] = await conmysql.query(
      'UPDATE descabezado SET usuario_id = ?, lote_id = ?, orden_id = ?, coche_id = ?, descabezado_libras_descabezadas = ?, descabezado_basura = ?, descabezado_rendimiento = ?, descabezado_observaciones = ? WHERE descabezado_id = ?',
      [usuario_id, lote_id, orden_id, coche_id, descabezado_libras_descabezadas, descabezado_basura, descabezado_rendimiento, descabezado_observaciones, id]
    );

    if (updateResult.affectedRows <= 0) return res.status(404).json({ message: "Descabezado no encontrado" });

    // Obtener actualizado
    const [actualizado] = await conmysql.query(`
      SELECT d.*, l.lote_codigo, u.usuario_nombre, o.orden_codigo, ch.coche_descripcion
      FROM descabezado d
      LEFT JOIN lote l ON d.lote_id = l.lote_id
      LEFT JOIN usuario u ON d.usuario_id = u.usuario_id
      LEFT JOIN orden o ON d.orden_id = o.orden_id
      LEFT JOIN coche ch ON d.coche_id = ch.coche_id
      WHERE d.descabezado_id = ?
    `, [id]);

    // Emitir WebSocket
    global._io.emit("descabezado_actualizado", actualizado[0]);

    res.json(actualizado[0]);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// PATCH: Actualización parcial, recalcular si necesario
export const pathDescabezado = async (req, res) => {
  try {
    const { id } = req.params;
    const campos = Object.keys(req.body);
    const valores = Object.values(req.body);

    if (campos.length === 0) return res.status(400).json({ message: "No se enviaron campos para actualizar" });

    const setClause = campos.map(campo => `${campo} = IFNULL(?, ${campo})`).join(', ');
    const [updateResult] = await conmysql.query(
      `UPDATE descabezado SET ${setClause} WHERE descabezado_id = ?`,
      [...valores, id]
    );

    if (updateResult.affectedRows <= 0) return res.status(404).json({ message: "Descabezado no encontrado" });

    // Recalcular rendimiento si campos relevantes cambiaron
    if (campos.some(c => ['lote_id', 'descabezado_libras_descabezadas', 'descabezado_basura'].includes(c))) {
      const [updated] = await conmysql.query('SELECT lote_id, descabezado_libras_descabezadas, descabezado_basura FROM descabezado WHERE descabezado_id = ?', [id]);
      const loteId = updated[0].lote_id;
      const librasDescabezadas = updated[0].descabezado_libras_descabezadas || 0;
      const basura = updated[0].descabezado_basura || 0;

      const [lote] = await conmysql.query('SELECT lote_libras_remitidas FROM lote WHERE lote_id = ?', [loteId]);
      const librasRemitidas = lote[0].lote_libras_remitidas || 0;

      const rendimiento = librasRemitidas > 0 ? ((librasDescabezadas - basura) / librasRemitidas * 100).toFixed(2) : 0;

      await conmysql.query('UPDATE descabezado SET descabezado_rendimiento = ? WHERE descabezado_id = ?', [rendimiento, id]);
    }

    // Obtener actualizado
    const [actualizado] = await conmysql.query(`
      SELECT d.*, l.lote_codigo, u.usuario_nombre, o.orden_codigo, ch.coche_descripcion
      FROM descabezado d
      LEFT JOIN lote l ON d.lote_id = l.lote_id
      LEFT JOIN usuario u ON d.usuario_id = u.usuario_id
      LEFT JOIN orden o ON d.orden_id = o.orden_id
      LEFT JOIN coche ch ON d.coche_id = ch.coche_id
      WHERE d.descabezado_id = ?
    `, [id]);

    // Emitir WebSocket
    global._io.emit("descabezado_actualizado", actualizado[0]);

    res.json(actualizado[0]);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// DELETE: Eliminar descabezado, emitir WS
export const deleteDescabezado = async (req, res) => {
  try {
    const { id } = req.params;

    await conmysql.query('DELETE FROM descabezado WHERE descabezado_id = ?', [id]);

    // Emitir WebSocket
    global._io.emit("descabezado_eliminado", { descabezado_id: parseInt(id) });

    res.status(202).json({ message: "Descabezado eliminado con éxito" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};