// src/controladores/masterizadoCtrl.js
import { conmysql } from "../db.js";

export const getMasterizado = async (req, res) => {
  try {
    const [rows] = await conmysql.query(`
      SELECT m.*, 
             l.lote_codigo,
             u.usuario_nombre,
             i.coche_descripcion,
             i.talla_descripcion,
             i.peso_descripcion AS peso_caja,
             i.ingresotunel_pesaje
      FROM masterizado m
      LEFT JOIN lote l ON m.lote_id = l.lote_id
      LEFT JOIN usuario u ON m.usuario_id = u.usuario_id
      LEFT JOIN ingresotunel i ON m.ingresotunel_id = i.ingresotunel_id
      ORDER BY m.masterizado_fecha DESC
    `);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getMasterizadoxid = async (req, res) => {
  try {
    const [rows] = await conmysql.query(`
      SELECT m.*, 
             l.lote_codigo,
             u.usuario_nombre,
             i.coche_descripcion,
             i.talla_descripcion,
             i.peso_descripcion AS peso_caja,
             i.ingresotunel_pesaje
      FROM masterizado m
      LEFT JOIN lote l ON m.lote_id = l.lote_id
      LEFT JOIN usuario u ON m.usuario_id = u.usuario_id
      LEFT JOIN ingresotunel i ON m.ingresotunel_id = i.ingresotunel_id
      WHERE m.masterizado_id = ?
    `, [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ message: "No encontrado" });
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const postMasterizado = async (req, res) => {
  try {
    const {
      lote_id,
      ingresotunel_id,
      usuario_id,
      masterizado_fecha,
      master_tipo,
      master_cantidad,
      masterizado_observaciones,
      masterizado_estado = 'pendiente'
    } = req.body;

    const [result] = await conmysql.query(`
      INSERT INTO masterizado 
      (lote_id, ingresotunel_id, usuario_id, masterizado_fecha, 
       master_tipo, master_cantidad, masterizado_observaciones, masterizado_estado)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [lote_id, ingresotunel_id, usuario_id, masterizado_fecha, 
         master_tipo, master_cantidad, masterizado_observaciones || null, masterizado_estado]);

    global._io?.emit("masterizado_nuevo", { masterizado_id: result.insertId });
    res.json({ masterizado_id: result.insertId, message: "Master creado" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const putMasterizado = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      lote_id, ingresotunel_id, usuario_id, masterizado_fecha,
      master_tipo, master_cantidad, masterizado_observaciones, masterizado_estado
    } = req.body;

    await conmysql.query(`
      UPDATE masterizado SET 
        lote_id=?, ingresotunel_id=?, usuario_id=?, masterizado_fecha=?,
        master_tipo=?, master_cantidad=?, masterizado_observaciones=?, masterizado_estado=?
      WHERE masterizado_id=?
    `, [lote_id, ingresotunel_id, usuario_id, masterizado_fecha,
         master_tipo, master_cantidad, masterizado_observaciones || null, masterizado_estado, id]);

    global._io?.emit("masterizado_actualizado", { masterizado_id: id });
    res.json({ message: "Actualizado" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteMasterizado = async (req, res) => {
  try {
    const { id } = req.params;
    await conmysql.query("DELETE FROM masterizado WHERE masterizado_id=?", [id]);
    global._io?.emit("masterizado_eliminado", { masterizado_id: id });
    res.json({ message: "Eliminado" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};