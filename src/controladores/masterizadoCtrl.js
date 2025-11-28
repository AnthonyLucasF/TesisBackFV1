// src/controladores/masterizadoCtrl.js
import { conmysql } from "../db.js";

// GET: Obtener todos masters ordenados DESC
export const getMasterizado = async (req, res) => {
  try {
    const [result] = await conmysql.query('SELECT * FROM masterizado ORDER BY masterizado_fecha DESC');
    res.json(result);
  } catch (error) {
    return res.status(500).json({ message: "Error al consultar Masters" });
  }
};

// GET por ID
export const getMasterizadoxid = async (req, res) => {
  try {
    const [result] = await conmysql.query('SELECT * FROM masterizado WHERE masterizado_id = ?', [req.params.id]);
    if (result.length <= 0) return res.status(404).json({ masterizado_id: 0, message: "Master no encontrado" });
    res.json(result[0]);
  } catch (error) {
    return res.status(500).json({ message: "Error del Servidor" });
  }
};

// POST: Crear master, validar, emitir WS
export const postMasterizado = async (req, res) => {
  try {
    const { lote_id, usuario_id, masterizado_fecha, masterizado_turno, masterizado_total_libras, masterizado_total_cajas, masterizado_total_master, masterizado_observaciones, masterizado_estado, ingresotunel_id } = req.body;

    const [rows] = await conmysql.query(
      'INSERT INTO masterizado (lote_id, usuario_id, masterizado_fecha, masterizado_turno, masterizado_total_libras, masterizado_total_cajas, masterizado_total_master, masterizado_observaciones, masterizado_estado, ingresotunel_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [lote_id, usuario_id, masterizado_fecha, masterizado_turno, masterizado_total_libras, masterizado_total_cajas, masterizado_total_master, masterizado_observaciones, masterizado_estado, ingresotunel_id]
    );

    global._io.emit("masterizado_nuevo", { masterizado_id: rows.insertId });

    res.json({ id: rows.insertId, message: "Master registrado con éxito" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// PUT: Update completo
export const putMasterizado = async (req, res) => {
  try {
    const { id } = req.params;
    const { lote_id, usuario_id, masterizado_fecha, masterizado_turno, masterizado_total_libras, masterizado_total_cajas, masterizado_total_master, masterizado_observaciones, masterizado_estado, ingresotunel_id } = req.body;

    const [result] = await conmysql.query(
      'UPDATE masterizado SET lote_id=?, usuario_id=?, masterizado_fecha=?, masterizado_turno=?, masterizado_total_libras=?, masterizado_total_cajas=?, masterizado_total_master=?, masterizado_observaciones=?, masterizado_estado=?, ingresotunel_id=? WHERE masterizado_id=?',
      [lote_id, usuario_id, masterizado_fecha, masterizado_turno, masterizado_total_libras, masterizado_total_cajas, masterizado_total_master, masterizado_observaciones, masterizado_estado, ingresotunel_id, id]
    );

    if (result.affectedRows <= 0) return res.status(404).json({ message: "Master no encontrado" });

    global._io.emit("masterizado_actualizado", { masterizado_id: id });

    const [rows] = await conmysql.query('SELECT * FROM masterizado WHERE masterizado_id=?', [id]);
    res.json(rows[0]);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// DELETE
export const deleteMasterizado = async (req, res) => {
  try {
    const { id } = req.params;

    await conmysql.query('DELETE FROM masterizado WHERE masterizado_id = ?', [id]);

    global._io.emit("masterizado_eliminado", { masterizado_id: id });

    res.status(202).json({ message: "Master eliminado con éxito" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};