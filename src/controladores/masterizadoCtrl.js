import { conmysql } from "../db.js";

// GET: Obtener todos los registros (sin clasificacion)
export const getMasterizado = async (req, res) => {
  try {
    const [result] = await conmysql.query(`
      SELECT m.*, l.lote_codigo, u.usuario_nombre
      FROM masterizado m
      JOIN lote l ON m.lote_id = l.lote_id
      JOIN usuario u ON m.usuario_id = u.usuario_id
    `);
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: "Error al consultar Datos de Masterizado", error });
  }
};

// GET: Obtener un registro por ID (sin clasificacion)
export const getMasterizadoxid = async (req, res) => {
  try {
    const [result] = await conmysql.query(`
      SELECT m.*, l.lote_codigo, u.usuario_nombre
      FROM masterizado m
      JOIN lote l ON m.lote_id = l.lote_id
      JOIN usuario u ON m.usuario_id = u.usuario_id
      WHERE m.masterizado_id = ?
    `, [req.params.id]);

    if (result.length === 0)
      return res.status(404).json({ masterizado_id: 0, message: "Datos de Masterizado no encontrados" });

    res.json(result[0]);
  } catch (error) {
    res.status(500).json({ message: "Error del Servidor", error });
  }
};

// POST: Insertar nuevo registro (sin clasificacion, emitir WS)
export const postMasterizado = async (req, res) => {
  try {
    const {
      lote_id, usuario_id,
      masterizado_fecha, masterizado_turno,
      masterizado_total_libras, masterizado_total_cajas,
      masterizado_total_master, masterizado_observaciones
    } = req.body;

    const [result] = await conmysql.query(`
      INSERT INTO masterizado
      (lote_id, usuario_id, masterizado_fecha, masterizado_turno,
       masterizado_total_libras, masterizado_total_cajas, masterizado_total_master, masterizado_observaciones)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        lote_id, usuario_id, masterizado_fecha, masterizado_turno,
        masterizado_total_libras, masterizado_total_cajas, masterizado_total_master, masterizado_observaciones
      ]
    );

    const nuevoId = result.insertId;
    const [nuevo] = await conmysql.query('SELECT * FROM masterizado WHERE masterizado_id = ?', [nuevoId]);

    // Emitir WebSocket
    global._io.emit("masterizado_nuevo", nuevo[0]);

    res.json({
      id: nuevoId,
      message: "Masterizado registrado con éxito"
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// PUT: Actualizar registro completo (sin clasificacion, emitir WS)
export const putMasterizado = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      lote_id, usuario_id,
      masterizado_fecha, masterizado_turno,
      masterizado_total_libras, masterizado_total_cajas,
      masterizado_total_master, masterizado_observaciones
    } = req.body;

    const [result] = await conmysql.query(`
      UPDATE masterizado SET
        lote_id = ?, usuario_id = ?,
        masterizado_fecha = ?, masterizado_turno = ?,
        masterizado_total_libras = ?, masterizado_total_cajas = ?,
        masterizado_total_master = ?, masterizado_observaciones = ?
      WHERE masterizado_id = ?`,
      [
        lote_id, usuario_id,
        masterizado_fecha, masterizado_turno,
        masterizado_total_libras, masterizado_total_cajas,
        masterizado_total_master, masterizado_observaciones, id
      ]
    );

    if (result.affectedRows === 0)
      return res.status(404).json({ message: "Masterizado no encontrado" });

    const [actualizado] = await conmysql.query('SELECT * FROM masterizado WHERE masterizado_id = ?', [id]);

    // Emitir WebSocket
    global._io.emit("masterizado_actualizado", actualizado[0]);

    res.json(actualizado[0]);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// PATCH: Actualización parcial (sin clasificacion, emitir WS)
export const pathMasterizado = async (req, res) => {
  try {
    const { id } = req.params;
    const campos = Object.keys(req.body);
    const valores = Object.values(req.body);

    if (campos.length === 0)
      return res.status(400).json({ message: "No se enviaron campos para actualizar" });

    const setClause = campos.map(campo => `${campo} = IFNULL(?, ${campo})`).join(', ');
    const [result] = await conmysql.query(
      `UPDATE masterizado SET ${setClause} WHERE masterizado_id = ?`,
      [...valores, id]
    );

    if (result.affectedRows === 0)
      return res.status(404).json({ message: "Masterizado no encontrado" });

    const [actualizado] = await conmysql.query('SELECT * FROM masterizado WHERE masterizado_id = ?', [id]);

    // Emitir WebSocket
    global._io.emit("masterizado_actualizado", actualizado[0]);

    res.json(actualizado[0]);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// DELETE: Eliminar registro (emitir WS)
export const deleteMasterizado = async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await conmysql.query('DELETE FROM masterizado WHERE masterizado_id = ?', [id]);

    if (rows.affectedRows === 0)
      return res.status(404).json({ id: 0, message: "Masterizado no encontrado" });

    // Emitir WebSocket
    global._io.emit("masterizado_eliminado", { masterizado_id: parseInt(id) });

    res.status(202).json({ message: "Masterizado eliminado con éxito" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};