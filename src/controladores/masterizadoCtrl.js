// src/controladores/masterizadoCtrl.js
import { conmysql } from "../db.js";

// GET /masterizado - Listar todos los masters
export const getMasterizado = async (req, res) => {
  try {
    const [rows] = await conmysql.query(`
      SELECT 
        m.masterizado_id,
        m.lote_id,
        m.coche_id,
        m.usuario_id,
        m.master_type AS master_tipo,
        m.masterizado_total_master AS master_cantidad,
        m.masterizado_total_cajas AS master_total_cajas,
        m.masterizado_total_libras AS master_total_libras,
        m.masterizado_fecha,
        m.masterizado_observaciones,
        m.masterizado_estado,
        l.lote_codigo,
        u.usuario_nombre,
        c.coche_descripcion
      FROM masterizado m
      LEFT JOIN lote l   ON m.lote_id  = l.lote_id
      LEFT JOIN usuario u ON m.usuario_id = u.usuario_id
      LEFT JOIN coche c   ON m.coche_id = c.coche_id
      ORDER BY m.masterizado_fecha DESC, m.masterizado_id DESC
    `);

    res.json(rows);
  } catch (error) {
    console.error("Error en getMasterizado:", error);
    res.status(500).json({ message: "Error listando masterizado", error: error.message });
  }
};

// GET /masterizado/:id - Obtener un master por ID
export const getMasterizadoxid = async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await conmysql.query(`
      SELECT 
        m.masterizado_id,
        m.lote_id,
        m.coche_id,
        m.usuario_id,
        m.master_type AS master_tipo,
        m.masterizado_total_master AS master_cantidad,
        m.masterizado_total_cajas AS master_total_cajas,
        m.masterizado_total_libras AS master_total_libras,
        m.masterizado_fecha,
        m.masterizado_observaciones,
        m.masterizado_estado,
        l.lote_codigo,
        u.usuario_nombre,
        c.coche_descripcion
      FROM masterizado m
      LEFT JOIN lote l   ON m.lote_id  = l.lote_id
      LEFT JOIN usuario u ON m.usuario_id = u.usuario_id
      LEFT JOIN coche c   ON m.coche_id = c.coche_id
      WHERE m.masterizado_id = ?
      LIMIT 1
    `, [id]);

    if (rows.length === 0) {
      return res.status(404).json({ message: "Master no encontrado" });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error("Error en getMasterizadoxid:", error);
    res.status(500).json({ message: "Error obteniendo masterizado", error: error.message });
  }
};

// POST /masterizado - Crear un nuevo master
export const postMasterizado = async (req, res) => {
  try {
    const {
      lote_id,
      coche_id,
      usuario_id,
      masterizado_fecha,
      master_tipo,             // '6' | '10' | '12'
      master_cantidad,         // número de masters
      master_total_cajas,      // total de cajas
      master_total_libras,     // total de libras
      masterizado_observaciones,
      masterizado_estado = 'pendiente'
    } = req.body;

    if (!lote_id || !usuario_id || !master_tipo || !master_cantidad) {
      return res.status(400).json({ message: "Datos incompletos para crear master" });
    }

    const [result] = await conmysql.query(`
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
    `, [
      lote_id,
      coche_id || null,
      usuario_id,
      master_tipo,
      masterizado_fecha,
      master_total_libras || 0,
      master_total_cajas || 0,
      master_cantidad || 0,
      masterizado_observaciones || null,
      masterizado_estado
    ]);

    const payload = { masterizado_id: result.insertId };

    global._io?.emit("masterizado_nuevo", payload);

    res.json({
      masterizado_id: result.insertId,
      message: "Master creado correctamente"
    });
  } catch (error) {
    console.error("Error en postMasterizado:", error);
    res.status(500).json({ message: "Error creando masterizado", error: error.message });
  }
};

// PUT /masterizado/:id - Actualizar un master
export const putMasterizado = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      lote_id,
      coche_id,
      usuario_id,
      masterizado_fecha,
      master_tipo,
      master_cantidad,
      master_total_cajas,
      master_total_libras,
      masterizado_observaciones,
      masterizado_estado
    } = req.body;

    const [result] = await conmysql.query(`
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
      lote_id,
      coche_id || null,
      usuario_id,
      master_tipo,
      masterizado_fecha,
      master_total_libras || 0,
      master_total_cajas || 0,
      master_cantidad || 0,
      masterizado_observaciones || null,
      masterizado_estado,
      id
    ]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Master no encontrado para actualizar" });
    }

    global._io?.emit("masterizado_actualizado", { masterizado_id: id });

    res.json({ message: "Master actualizado correctamente" });
  } catch (error) {
    console.error("Error en putMasterizado:", error);
    res.status(500).json({ message: "Error actualizando masterizado", error: error.message });
  }
};

// DELETE /masterizado/:id - Eliminar un master
export const deleteMasterizado = async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await conmysql.query(
      "DELETE FROM masterizado WHERE masterizado_id = ?",
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Master no encontrado para eliminar" });
    }

    global._io?.emit("masterizado_eliminado", { masterizado_id: id });

    res.json({ message: "Master eliminado correctamente" });
  } catch (error) {
    console.error("Error en deleteMasterizado:", error);
    res.status(500).json({ message: "Error eliminando masterizado", error: error.message });
  }
};
