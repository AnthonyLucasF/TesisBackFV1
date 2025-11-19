import { conmysql } from "../db.js";

// GET: Obtener todas las órdenes con JOIN talla, calcular pendientes, ordenadas por fecha descendente
export const getOrden = async (req, res) => {
  try {
    const [result] = await conmysql.query(`
      SELECT o.*, t.talla_descripcion,
        (o.orden_total_libras - IFNULL(SUM(i.ingresotunel_total), 0)) as orden_libras_pendientes
      FROM orden o
      LEFT JOIN talla t ON o.talla_id = t.talla_id
      LEFT JOIN ingresotunel i ON o.orden_id = i.orden_id
      GROUP BY o.orden_id
      ORDER BY o.orden_fecha_produccion DESC
    `);
    res.json(result);
  } catch (error) {
    return res.status(500).json({ message: "Error al consultar Órdenes" });
  }
};

// GET por ID con pendientes
export const getOrdenxid = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({ message: "ID de orden inválido" });
    }
    const [result] = await conmysql.query(`
      SELECT o.*, t.talla_descripcion,
        (o.orden_total_libras - IFNULL(SUM(i.ingresotunel_total), 0)) as orden_libras_pendientes
      FROM orden o
      LEFT JOIN talla t ON o.talla_id = t.talla_id
      LEFT JOIN ingresotunel i ON o.orden_id = i.orden_id
      WHERE o.orden_id = ?
      GROUP BY o.orden_id
    `, [id]);
    if (result.length <= 0) return res.status(404).json({ orden_id: 0, message: "Orden no encontrada" });
    res.json(result[0]);
  } catch (error) {
    return res.status(500).json({ message: "Error del Servidor" });
  }
};

// GET pendientes por talla (para filtro en empaque)
export const getOrdenesPendientes = async (req, res) => {
  try {
    const { talla_id } = req.query;
    if (!talla_id) return res.status(400).json({ message: "talla_id required" });

    const [result] = await conmysql.query(`
      SELECT o.*, t.talla_descripcion,
        (o.orden_total_libras - IFNULL(SUM(i.ingresotunel_total), 0)) as orden_libras_pendientes
      FROM orden o
      LEFT JOIN talla t ON o.talla_id = t.talla_id
      LEFT JOIN ingresotunel i ON o.orden_id = i.orden_id
      WHERE o.talla_id = ? AND o.orden_estado = 'pendiente'
      GROUP BY o.orden_id
      HAVING orden_libras_pendientes > 0
      ORDER BY o.orden_fecha_produccion ASC  // Antigua primero
    `, [talla_id]);

    res.json(result); // Si vacío, devuelve [] sin error
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// POST: Crear orden, set pendientes = total_libras, estado 'pendiente', emitir WS
export const postOrden = async (req, res) => {
  try {
    const { orden_codigo, orden_descripcion, orden_cliente, orden_lote_cliente, orden_fecha_produccion, orden_fecha_juliana, orden_talla_real, orden_talla_marcada, orden_microlote, orden_total_master, orden_total_libras, talla_id } = req.body;

    if (!orden_total_libras || !talla_id) return res.status(400).json({ message: "orden_total_libras y talla_id requeridos" });

    const orden_libras_pendientes = orden_total_libras;
    const orden_estado = 'pendiente';

    const [insertResult] = await conmysql.query(
      'INSERT INTO orden (orden_codigo, orden_descripcion, orden_cliente, orden_lote_cliente, orden_fecha_produccion, orden_fecha_juliana, orden_talla_real, orden_talla_marcada, orden_microlote, orden_total_master, orden_total_libras, orden_libras_pendientes, orden_estado, talla_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [orden_codigo, orden_descripcion, orden_cliente, orden_lote_cliente, orden_fecha_produccion, orden_fecha_juliana, orden_talla_real, orden_talla_marcada, orden_microlote, orden_total_master, orden_total_libras, orden_libras_pendientes, orden_estado, talla_id]
    );

    const nuevoId = insertResult.insertId;

    const [nuevo] = await conmysql.query('SELECT * FROM orden WHERE orden_id = ?', [nuevoId]);

    // Emitir WebSocket
    global._io.emit("orden_nueva", nuevo[0]);

    res.json(nuevo[0]);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// PUT: Actualizar orden completa, recalcular pendientes, emitir WS
export const putOrden = async (req, res) => {
  try {
    const { id } = req.params;
    const { orden_codigo, orden_descripcion, orden_cliente, orden_lote_cliente, orden_fecha_produccion, orden_fecha_juliana, orden_talla_real, orden_talla_marcada, orden_microlote, orden_total_master, orden_total_libras, talla_id } = req.body;

    // Obtener empacadas actuales
    const [aggreg] = await conmysql.query('SELECT SUM(ingresotunel_total) as empacadas FROM ingresotunel WHERE orden_id = ?', [id]);
    const empacadas = aggreg[0].empacadas || 0;

    const orden_libras_pendientes = orden_total_libras - empacadas;
    const orden_estado = orden_libras_pendientes > 0 ? 'pendiente' : 'cumplida';

    const [updateResult] = await conmysql.query(
      'UPDATE orden SET orden_codigo = ?, orden_descripcion = ?, orden_cliente = ?, orden_lote_cliente = ?, orden_fecha_produccion = ?, orden_fecha_juliana = ?, orden_talla_real = ?, orden_talla_marcada = ?, orden_microlote = ?, orden_total_master = ?, orden_total_libras = ?, orden_libras_pendientes = ?, orden_estado = ?, talla_id = ? WHERE orden_id = ?',
      [orden_codigo, orden_descripcion, orden_cliente, orden_lote_cliente, orden_fecha_produccion, orden_fecha_juliana, orden_talla_real, orden_talla_marcada, orden_microlote, orden_total_master, orden_total_libras, orden_libras_pendientes, orden_estado, talla_id, id]
    );

    if (updateResult.affectedRows <= 0) return res.status(404).json({ message: "Orden no encontrada" });

    const [actualizado] = await conmysql.query('SELECT * FROM orden WHERE orden_id = ?', [id]);

    // Emitir WebSocket
    global._io.emit("orden_actualizada", actualizado[0]);
    if (orden_estado === 'cumplida') {
      global._io.emit("orden_cumplida", actualizado[0]);
    }

    res.json(actualizado[0]);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// DELETE: Eliminar orden, emitir WS
export const deleteOrden = async (req, res) => {
  try {
    const { id } = req.params;

    await conmysql.query('DELETE FROM orden WHERE orden_id = ?', [id]);

    // Emitir WebSocket
    global._io.emit("orden_eliminada", { orden_id: parseInt(id) });

    res.status(202).json({ message: "Orden eliminada con éxito" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};