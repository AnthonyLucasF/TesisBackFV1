// src/controladores/masterizadoCtrl.js
import { conmysql } from "../db.js";

/**
 * GET /masterizado
 * Lista de masters con datos de lote, coche y usuario
 */
export const getMasterizado = async (req, res) => {
  try {
    const [rows] = await conmysql.query(`
      SELECT 
        m.*,
        l.lote_codigo,
        u.usuario_nombre,
        c.coche_descripcion
      FROM masterizado m
      LEFT JOIN lote l     ON m.lote_id  = l.lote_id
      LEFT JOIN usuario u  ON m.usuario_id = u.usuario_id
      LEFT JOIN coche c    ON m.coche_id = c.coche_id
      ORDER BY m.masterizado_fecha DESC, m.masterizado_id DESC
    `);

    res.json(rows);
  } catch (error) {
    console.error("getMasterizado error:", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * GET /masterizado/:id
 * Detalle de un master
 */
export const getMasterizadoxid = async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await conmysql.query(`
      SELECT 
        m.*,
        l.lote_codigo,
        u.usuario_nombre,
        c.coche_descripcion
      FROM masterizado m
      LEFT JOIN lote l     ON m.lote_id  = l.lote_id
      LEFT JOIN usuario u  ON m.usuario_id = u.usuario_id
      LEFT JOIN coche c    ON m.coche_id = c.coche_id
      WHERE m.masterizado_id = ?
    `, [id]);

    if (rows.length === 0) {
      return res.status(404).json({ message: "No encontrado" });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error("getMasterizadoxid error:", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * POST /masterizado
 * Crear nuevo master
 */
export const postMasterizado = async (req, res) => {
  try {
    const {
      lote_id,
      coche_id,
      usuario_id,
      masterizado_fecha,
      master_type,                  // '6' | '10' | '12'
      masterizado_total_master,
      masterizado_total_cajas,
      masterizado_total_libras,
      masterizado_observaciones,
      masterizado_estado = "pendiente"
    } = req.body;

    const [result] = await conmysql.query(
      `
      INSERT INTO masterizado (
        lote_id,
        coche_id,
        usuario_id,
        master_type,
        masterizado_fecha,
        masterizado_total_libras,
        masterizado_total_cajas,
        masterizado_total_master,
        masterizado_observaciones,
        masterizado_estado
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        lote_id || null,
        coche_id || null,
        usuario_id || null,
        master_type || null,
        masterizado_fecha || null,
        masterizado_total_libras || 0,
        masterizado_total_cajas || 0,
        masterizado_total_master || 0,
        masterizado_observaciones || null,
        masterizado_estado || "pendiente"
      ]
    );

    const masterizado_id = result.insertId;

    const [rows] = await conmysql.query(
      `
      SELECT 
        m.*,
        l.lote_codigo,
        u.usuario_nombre,
        c.coche_descripcion
      FROM masterizado m
      LEFT JOIN lote l     ON m.lote_id  = l.lote_id
      LEFT JOIN usuario u  ON m.usuario_id = u.usuario_id
      LEFT JOIN coche c    ON m.coche_id = c.coche_id
      WHERE m.masterizado_id = ?
      `,
      [masterizado_id]
    );

    const data = rows[0];

    // Notificar por socket (si está habilitado)
    global._io?.emit("masterizado_nuevo", data);

    res.json(data);
  } catch (error) {
    console.error("postMasterizado error:", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * PUT /masterizado/:id
 * Actualizar master
 */
export const putMasterizado = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      lote_id,
      coche_id,
      usuario_id,
      masterizado_fecha,
      master_type,
      masterizado_total_master,
      masterizado_total_cajas,
      masterizado_total_libras,
      masterizado_observaciones,
      masterizado_estado
    } = req.body;

    await conmysql.query(
      `
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
      `,
      [
        lote_id || null,
        coche_id || null,
        usuario_id || null,
        master_type || null,
        masterizado_fecha || null,
        masterizado_total_libras || 0,
        masterizado_total_cajas || 0,
        masterizado_total_master || 0,
        masterizado_observaciones || null,
        masterizado_estado || "pendiente",
        id
      ]
    );

    const [rows] = await conmysql.query(
      `
      SELECT 
        m.*,
        l.lote_codigo,
        u.usuario_nombre,
        c.coche_descripcion
      FROM masterizado m
      LEFT JOIN lote l     ON m.lote_id  = l.lote_id
      LEFT JOIN usuario u  ON m.usuario_id = u.usuario_id
      LEFT JOIN coche c    ON m.coche_id = c.coche_id
      WHERE m.masterizado_id = ?
      `,
      [id]
    );

    const data = rows[0];

    global._io?.emit("masterizado_actualizado", data);
    res.json(data);
  } catch (error) {
    console.error("putMasterizado error:", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * DELETE /masterizado/:id
 * Eliminar master
 */
export const deleteMasterizado = async (req, res) => {
  try {
    const { id } = req.params;

    await conmysql.query(
      "DELETE FROM masterizado WHERE masterizado_id = ?",
      [id]
    );

    global._io?.emit("masterizado_eliminado", { masterizado_id: Number(id) });

    res.json({ message: "Eliminado" });
  } catch (error) {
    console.error("deleteMasterizado error:", error);
    res.status(500).json({ message: error.message });
  }
};
