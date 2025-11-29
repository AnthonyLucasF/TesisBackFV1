// src/controladores/descabezadoCtrl.js
import { conmysql } from "../db.js";

/* ============================================================
   GET: Listar todos
   ============================================================ */
export const getDescabezado = async (req, res) => {
  try {
    const [result] = await conmysql.query(`
      SELECT d.*, l.lote_codigo, u.usuario_nombre
      FROM descabezado d
      LEFT JOIN lote l ON d.lote_id = l.lote_id
      LEFT JOIN usuario u ON d.usuario_id = u.usuario_id
      ORDER BY d.descabezado_fecha DESC
    `);
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: "Error al consultar Descabezado" });
  }
};

/* ============================================================
   GET: Por ID
   ============================================================ */
export const getDescabezadoxid = async (req, res) => {
  try {
    const [result] = await conmysql.query(`
      SELECT d.*, l.lote_codigo, u.usuario_nombre
      FROM descabezado d
      LEFT JOIN lote l ON d.lote_id = l.lote_id
      LEFT JOIN usuario u ON d.usuario_id = u.usuario_id
      WHERE d.descabezado_id = ?
    `, [req.params.id]);

    if (result.length === 0)
      return res.status(404).json({ message: "Descabezado no encontrado" });

    res.json(result[0]);
  } catch (error) {
    res.status(500).json({ message: "Error del servidor" });
  }
};

/* ============================================================
   POST: Crear descabezado (consume sobrante del lote entero)
   ============================================================ */
export const postDescabezado = async (req, res) => {
  try {
    const { usuario_id, lote_id, lbs_entrada, descabezado_observaciones } = req.body;

    if (!usuario_id || !lote_id || !lbs_entrada)
      return res.status(400).json({ message: "usuario_id, lote_id y lbs_entrada son requeridos" });

    // Obtener sobrante del lote entero
    const [ingreso] = await conmysql.query(
      "SELECT lote_sobrante FROM ingresotunel WHERE lote_id = ?",
      [lote_id]
    );

    if (!ingreso[0])
      return res.status(404).json({ message: "Sobrante no encontrado en ingreso túnel" });

    const sobranteActual = ingreso[0].lote_sobrante;

    if (lbs_entrada > sobranteActual)
      return res.status(400).json({ message: "Sobrante insuficiente" });

    // Insert descabezado
    const fecha = new Date().toISOString().slice(0, 19).replace("T", " ");

    const [insert] = await conmysql.query(`
      INSERT INTO descabezado (usuario_id, lote_id, descabezado_fecha, descabezado_lbs_entrada, descabezado_observaciones)
      VALUES (?, ?, ?, ?, ?)
    `, [usuario_id, lote_id, fecha, lbs_entrada, descabezado_observaciones]);

    const nuevoId = insert.insertId;

    // Actualizar sobrante
    const sobranteNuevo = sobranteActual - lbs_entrada;

    await conmysql.query(`
      UPDATE ingresotunel SET lote_sobrante = ? WHERE lote_id = ?
    `, [sobranteNuevo, lote_id]);

    // Crear sublote COLA (tipo=2)
    const [padre] = await conmysql.query(
      "SELECT lote_codigo FROM lote WHERE lote_id = ?",
      [lote_id]
    );

    const subCodigo = `SUB-${padre[0].lote_codigo}-COLA`;

    const [sub] = await conmysql.query(`
      INSERT INTO lote (lote_codigo, parent_lote_id, tipo_id, lote_libras_remitidas, lote_sobrante)
      VALUES (?, ?, 2, ?, ?)
    `, [subCodigo, lote_id, lbs_entrada, lbs_entrada]);

    const subloteId = sub.insertId;

    // Emitir websocket
    global._io.emit("descabezado_nuevo", {
      descabezado_id: nuevoId,
      sublote_id: subloteId
    });

    res.json({
      message: "Descabezado creado",
      descabezado_id: nuevoId,
      sublote_id: subloteId,
      sobrante_restante: sobranteNuevo
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* ============================================================
   PUT: Actualizar completamente
   ============================================================ */
export const putDescabezado = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      usuario_id,
      lote_id,
      descabezado_lbs_entrada,
      descabezado_observaciones
    } = req.body;

    const [result] = await conmysql.query(`
      UPDATE descabezado SET
      usuario_id = ?, lote_id = ?, descabezado_lbs_entrada = ?, descabezado_observaciones = ?
      WHERE descabezado_id = ?
    `, [usuario_id, lote_id, descabezado_lbs_entrada, descabezado_observaciones, id]);

    if (result.affectedRows === 0)
      return res.status(404).json({ message: "Descabezado no encontrado" });

    global._io.emit("descabezado_actualizado", { descabezado_id: id });

    res.json({ message: "Descabezado actualizado" });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* ============================================================
   PATCH: Actualización parcial
   ============================================================ */
export const pathDescabezado = async (req, res) => {
  try {
    const { id } = req.params;

    const campos = Object.keys(req.body);
    const valores = Object.values(req.body);

    if (campos.length === 0)
      return res.status(400).json({ message: "No se enviaron campos" });

    const setClause = campos.map(c => `${c} = ?`).join(", ");

    const [result] = await conmysql.query(`
      UPDATE descabezado SET ${setClause} WHERE descabezado_id = ?
    `, [...valores, id]);

    if (result.affectedRows === 0)
      return res.status(404).json({ message: "Descabezado no encontrado" });

    global._io.emit("descabezado_actualizado", { descabezado_id: id });

    res.json({ message: "Descabezado actualizado parcialmente" });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* ============================================================
   DELETE
   ============================================================ */
export const deleteDescabezado = async (req, res) => {
  try {
    const [result] = await conmysql.query(
      "DELETE FROM descabezado WHERE descabezado_id = ?",
      [req.params.id]
    );

    if (result.affectedRows === 0)
      return res.status(404).json({ message: "Descabezado no encontrado" });

    global._io.emit("descabezado_eliminado", { descabezado_id: parseInt(req.params.id) });

    res.json({ message: "Descabezado eliminado" });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
