// src/controladores/peladoCtrl.js
import { conmysql } from "../db.js";

// GET: Obtener todos los pelados con JOINs, ordenados por fecha descendente
export const getPelado = async (req, res) => {
  try {
    const [result] = await conmysql.query(`
      SELECT p.*, l.lote_codigo, u.usuario_nombre, o.orden_codigo, ch.coche_descripcion, cr.corte_descripcion
      FROM pelado p
      LEFT JOIN lote l ON p.lote_id = l.lote_id
      LEFT JOIN usuario u ON p.usuario_id = u.usuario_id
      LEFT JOIN orden o ON p.orden_id = o.orden_id
      LEFT JOIN coche ch ON p.coche_id = ch.coche_id
      LEFT JOIN corte cr ON p.corte_id = cr.corte_id
      ORDER BY p.pelado_fecha DESC
    `);
    res.json(result);
  } catch (error) {
    return res.status(500).json({ message: "Error al consultar Pelado" });
  }
};

// GET por ID con JOINs
export const getPeladoxid = async (req, res) => {
  try {
    const [result] = await conmysql.query(`
      SELECT p.*, l.lote_codigo, u.usuario_nombre, o.orden_codigo, ch.coche_descripcion, cr.corte_descripcion
      FROM pelado p
      LEFT JOIN lote l ON p.lote_id = l.lote_id
      LEFT JOIN usuario u ON p.usuario_id = u.usuario_id
      LEFT JOIN orden o ON p.orden_id = o.orden_id
      LEFT JOIN coche ch ON p.coche_id = ch.coche_id
      LEFT JOIN corte cr ON p.corte_id = cr.corte_id
      WHERE p.pelado_id = ?
    `, [req.params.id]);
    if (result.length <= 0) return res.status(404).json({ pelado_id: 0, message: "Pelado no encontrado" });
    res.json(result[0]);
  } catch (error) {
    return res.status(500).json({ message: "Error del Servidor" });
  }
};

// POST: Registrar pelado, calcular rendimiento, crear sublote si necesario, emitir WS
export const postPelado = async (req, res) => {
  try {
    const { usuario_id, lote_id, orden_id, coche_id, corte_id, pelado_libras_peladas, pelado_basura, pelado_observaciones } = req.body;

    if (!lote_id || !orden_id || !coche_id || !corte_id) return res.status(400).json({ message: "lote_id, orden_id, coche_id y corte_id son requeridos" });

    // Obtener promedio del lote
    const [lote] = await conmysql.query('SELECT lote_libras_remitidas FROM lote WHERE lote_id = ?', [lote_id]);
    const librasRemitidas = lote[0].lote_libras_remitidas || 0;

    // Calcular rendimiento
    const pelado_rendimiento = librasRemitidas > 0 ? ((pelado_libras_peladas - pelado_basura) / librasRemitidas * 100).toFixed(2) : 0;

    // Fecha actual
    const pelado_fecha = new Date().toISOString().slice(0, 19).replace('T', ' ');

    // Insertar pelado
    const [insertResult] = await conmysql.query(
      'INSERT INTO pelado (usuario_id, lote_id, orden_id, coche_id, corte_id, pelado_fecha, pelado_libras_peladas, pelado_basura, pelado_rendimiento, pelado_observaciones) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [usuario_id, lote_id, orden_id, coche_id, corte_id, pelado_fecha, pelado_libras_peladas, pelado_basura, pelado_rendimiento, pelado_observaciones]
    );

    const nuevoId = insertResult.insertId;

    // Crear sublote para pelado (parent_lote_id = lote_id actual)
    const subloteCodigo = `SUB-${lote[0].lote_codigo}-PELADO`; // Ejemplo
    await conmysql.query(
      'INSERT INTO lote (lote_codigo, parent_lote_id, lote_libras_remitidas, lote_peso_promedio /* otros */) VALUES (?, ?, ?, ? /* valores */)',
      [subloteCodigo, lote_id, pelado_libras_peladas, pelado_libras_peladas /* ajustar */]
    );

    // Obtener registro completo
    const [nuevo] = await conmysql.query(`
      SELECT p.*, l.lote_codigo, u.usuario_nombre, o.orden_codigo, ch.coche_descripcion, cr.corte_descripcion
      FROM pelado p
      LEFT JOIN lote l ON p.lote_id = l.lote_id
      LEFT JOIN usuario u ON p.usuario_id = u.usuario_id
      LEFT JOIN orden o ON p.orden_id = o.orden_id
      LEFT JOIN coche ch ON p.coche_id = ch.coche_id
      LEFT JOIN corte cr ON p.corte_id = cr.corte_id
      WHERE p.pelado_id = ?
    `, [nuevoId]);

    // Emitir WebSocket
    global._io.emit("pelado_nuevo", nuevo[0]);

    res.json(nuevo[0]);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// PUT: Actualizar pelado completo, recalcular rendimiento, emitir WS
export const putPelado = async (req, res) => {
  try {
    const { id } = req.params;
    const { usuario_id, lote_id, orden_id, coche_id, corte_id, pelado_libras_peladas, pelado_basura, pelado_observaciones } = req.body;

    // Obtener promedio
    const [lote] = await conmysql.query('SELECT lote_libras_remitidas FROM lote WHERE lote_id = ?', [lote_id]);
    const librasRemitidas = lote[0].lote_libras_remitidas || 0;

    // Recalcular rendimiento
    const pelado_rendimiento = librasRemitidas > 0 ? ((pelado_libras_peladas - pelado_basura) / librasRemitidas * 100).toFixed(2) : 0;

    // Actualizar
    const [updateResult] = await conmysql.query(
      'UPDATE pelado SET usuario_id = ?, lote_id = ?, orden_id = ?, coche_id = ?, corte_id = ?, pelado_libras_peladas = ?, pelado_basura = ?, pelado_rendimiento = ?, pelado_observaciones = ? WHERE pelado_id = ?',
      [usuario_id, lote_id, orden_id, coche_id, corte_id, pelado_libras_peladas, pelado_basura, pelado_rendimiento, pelado_observaciones, id]
    );

    if (updateResult.affectedRows <= 0) return res.status(404).json({ message: "Pelado no encontrado" });

    // Obtener actualizado
    const [actualizado] = await conmysql.query(`
      SELECT p.*, l.lote_codigo, u.usuario_nombre, o.orden_codigo, ch.coche_descripcion, cr.corte_descripcion
      FROM pelado p
      LEFT JOIN lote l ON p.lote_id = l.lote_id
      LEFT JOIN usuario u ON p.usuario_id = u.usuario_id
      LEFT JOIN orden o ON p.orden_id = o.orden_id
      LEFT JOIN coche ch ON p.coche_id = ch.coche_id
      LEFT JOIN corte cr ON p.corte_id = cr.corte_id
      WHERE p.pelado_id = ?
    `, [id]);

    // Emitir WebSocket
    global._io.emit("pelado_actualizado", actualizado[0]);

    res.json(actualizado[0]);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// PATCH: Actualización parcial, recalcular si necesario
export const pathPelado = async (req, res) => {
  try {
    const { id } = req.params;
    const campos = Object.keys(req.body);
    const valores = Object.values(req.body);

    if (campos.length === 0) return res.status(400).json({ message: "No se enviaron campos para actualizar" });

    const setClause = campos.map(campo => `${campo} = IFNULL(?, ${campo})`).join(', ');
    const [updateResult] = await conmysql.query(
      `UPDATE pelado SET ${setClause} WHERE pelado_id = ?`,
      [...valores, id]
    );

    if (updateResult.affectedRows <= 0) return res.status(404).json({ message: "Pelado no encontrado" });

    // Recalcular rendimiento si relevante
    if (campos.some(c => ['lote_id', 'pelado_libras_peladas', 'pelado_basura'].includes(c))) {
      const [updated] = await conmysql.query('SELECT lote_id, pelado_libras_peladas, pelado_basura FROM pelado WHERE pelado_id = ?', [id]);
      const loteId = updated[0].lote_id;
      const librasPeladas = updated[0].pelado_libras_peladas || 0;
      const basura = updated[0].pelado_basura || 0;

      const [lote] = await conmysql.query('SELECT lote_libras_remitidas FROM lote WHERE lote_id = ?', [loteId]);
      const librasRemitidas = lote[0].lote_libras_remitidas || 0;

      const rendimiento = librasRemitidas > 0 ? ((librasPeladas - basura) / librasRemitidas * 100).toFixed(2) : 0;

      await conmysql.query('UPDATE pelado SET pelado_rendimiento = ? WHERE pelado_id = ?', [rendimiento, id]);
    }

    // Obtener actualizado
    const [actualizado] = await conmysql.query(`
      SELECT p.*, l.lote_codigo, u.usuario_nombre, o.orden_codigo, ch.coche_descripcion, cr.corte_descripcion
      FROM pelado p
      LEFT JOIN lote l ON p.lote_id = l.lote_id
      LEFT JOIN usuario u ON p.usuario_id = u.usuario_id
      LEFT JOIN orden o ON p.orden_id = o.orden_id
      LEFT JOIN coche ch ON p.coche_id = ch.coche_id
      LEFT JOIN corte cr ON p.corte_id = cr.corte_id
      WHERE p.pelado_id = ?
    `, [id]);

    // Emitir WebSocket
    global._io.emit("pelado_actualizado", actualizado[0]);

    res.json(actualizado[0]);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// DELETE: Eliminar pelado, emitir WS
export const deletePelado = async (req, res) => {
  try {
    const { id } = req.params;

    await conmysql.query('DELETE FROM pelado WHERE pelado_id = ?', [id]);

    // Emitir WebSocket
    global._io.emit("pelado_eliminado", { pelado_id: parseInt(id) });

    res.status(202).json({ message: "Pelado eliminado con éxito" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};