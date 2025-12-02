// src/controladores/masterizadoCtrl.js
import { conmysql } from "../db.js";

// GET /masterizado  -> Listar todos los masters
export const getMasterizado = async (req, res) => {
  try {
    const [rows] = await conmysql.query(`
      SELECT 
        m.masterizado_id,
        m.lote_id,
        m.coche_id,
        m.usuario_id,
        m.master_type,
        m.masterizado_fecha,
        m.masterizado_total_libras,
        m.masterizado_total_cajas,
        m.masterizado_total_master,
        m.masterizado_observaciones,
        m.masterizado_estado,
        l.lote_codigo,
        u.usuario_nombre,
        c.coche_descripcion
      FROM masterizado m
      LEFT JOIN lote   l ON m.lote_id  = l.lote_id
      LEFT JOIN usuario u ON m.usuario_id = u.usuario_id
      LEFT JOIN coche  c ON m.coche_id = c.coche_id
      ORDER BY m.masterizado_fecha DESC, m.masterizado_id DESC
    `);

    res.json(rows);
  } catch (error) {
    console.error("Error getMasterizado:", error);
    res.status(500).json({ message: "Error al listar masterizado", error: error.message });
  }
};

// GET /masterizado/:id  -> Detalle por ID
export const getMasterizadoxid = async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await conmysql.query(`
      SELECT 
        m.masterizado_id,
        m.lote_id,
        m.coche_id,
        m.usuario_id,
        m.master_type,
        m.masterizado_fecha,
        m.masterizado_total_libras,
        m.masterizado_total_cajas,
        m.masterizado_total_master,
        m.masterizado_observaciones,
        m.masterizado_estado,
        l.lote_codigo,
        u.usuario_nombre,
        c.coche_descripcion
      FROM masterizado m
      LEFT JOIN lote   l ON m.lote_id  = l.lote_id
      LEFT JOIN usuario u ON m.usuario_id = u.usuario_id
      LEFT JOIN coche  c ON m.coche_id = c.coche_id
      WHERE m.masterizado_id = ?
    `, [id]);

    if (rows.length === 0) {
      return res.status(404).json({ message: "Masterizado no encontrado" });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error("Error getMasterizadoxid:", error);
    res.status(500).json({ message: "Error al obtener detalle de masterizado", error: error.message });
  }
};

// POST /masterizado  -> Crear
export const postMasterizado = async (req, res) => {
  try {
    const {
      lote_id,
      coche_id,
      usuario_id,
      masterizado_fecha,
      master_type, // '6' | '10' | '12'
      masterizado_total_libras,
      masterizado_total_cajas,
      masterizado_total_master,
      masterizado_observaciones,
      masterizado_estado = 'pendiente'
    } = req.body;

    const [result] = await conmysql.query(`
      INSERT INTO masterizado
      (lote_id, coche_id, usuario_id, master_type, masterizado_fecha,
       masterizado_total_libras, masterizado_total_cajas, masterizado_total_master,
       masterizado_observaciones, masterizado_estado)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      lote_id || null,
      coche_id || null,
      usuario_id || null,
      master_type || '12',
      masterizado_fecha || new Date(),
      masterizado_total_libras || 0,
      masterizado_total_cajas || 0,
      masterizado_total_master || 0,
      masterizado_observaciones || null,
      masterizado_estado || 'pendiente'
    ]);

    const masterizado_id = result.insertId;

    // Emitir evento por WebSocket si está configurado
    global._io?.emit("masterizado_nuevo", { masterizado_id });

    // Devolver el registro recién creado con joins
    const [rows] = await conmysql.query(`
      SELECT 
        m.masterizado_id,
        m.lote_id,
        m.coche_id,
        m.usuario_id,
        m.master_type,
        m.masterizado_fecha,
        m.masterizado_total_libras,
        m.masterizado_total_cajas,
        m.masterizado_total_master,
        m.masterizado_observaciones,
        m.masterizado_estado,
        l.lote_codigo,
        u.usuario_nombre,
        c.coche_descripcion
      FROM masterizado m
      LEFT JOIN lote   l ON m.lote_id  = l.lote_id
      LEFT JOIN usuario u ON m.usuario_id = u.usuario_id
      LEFT JOIN coche  c ON m.coche_id = c.coche_id
      WHERE m.masterizado_id = ?
    `, [masterizado_id]);

    res.json(rows[0]);
  } catch (error) {
    console.error("Error postMasterizado:", error);
    res.status(500).json({ message: "Error al crear masterizado", error: error.message });
  }
};

// PUT /masterizado/:id  -> Actualizar
export const putMasterizado = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      lote_id,
      coche_id,
      usuario_id,
      masterizado_fecha,
      master_type,
      masterizado_total_libras,
      masterizado_total_cajas,
      masterizado_total_master,
      masterizado_observaciones,
      masterizado_estado
    } = req.body;

    await conmysql.query(`
      UPDATE masterizado SET
        lote_id = ?,
        coche_id = ?,
        usuario_id = ?,
        master_type = ?,
        masterizado_fecha = ?,
        masterizado_total_libras = ?,
        masterizado_total_cajas = ?,
        masterizado_total_master = ?,
        masterizado_observaciones = ?,
        masterizado_estado = ?
      WHERE masterizado_id = ?
    `, [
      lote_id || null,
      coche_id || null,
      usuario_id || null,
      master_type || '12',
      masterizado_fecha || new Date(),
      masterizado_total_libras || 0,
      masterizado_total_cajas || 0,
      masterizado_total_master || 0,
      masterizado_observaciones || null,
      masterizado_estado || 'pendiente',
      id
    ]);

    global._io?.emit("masterizado_actualizado", { masterizado_id: id });

    res.json({ message: "Masterizado actualizado correctamente" });
  } catch (error) {
    console.error("Error putMasterizado:", error);
    res.status(500).json({ message: "Error al actualizar masterizado", error: error.message });
  }
};

// DELETE /masterizado/:id  -> Eliminar
export const deleteMasterizado = async (req, res) => {
  try {
    const { id } = req.params;

    await conmysql.query(
      "DELETE FROM masterizado WHERE masterizado_id = ?",
      [id]
    );

    global._io?.emit("masterizado_eliminado", { masterizado_id: id });

    res.json({ message: "Masterizado eliminado correctamente" });
  } catch (error) {
    console.error("Error deleteMasterizado:", error);
    res.status(500).json({ message: "Error al eliminar masterizado", error: error.message });
  }
};
