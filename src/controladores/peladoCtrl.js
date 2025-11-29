// src/controladores/peladoCtrl.js
import { conmysql } from "../db.js";

/* ============================================================
   GET: Listar todos
   ============================================================ */
export const getPelado = async (req, res) => {
  try {
    const [result] = await conmysql.query(`
      SELECT p.*, l.lote_codigo, u.usuario_nombre, cr.corte_descripcion
      FROM pelado p
      LEFT JOIN lote l ON p.lote_id = l.lote_id
      LEFT JOIN usuario u ON p.usuario_id = u.usuario_id
      LEFT JOIN corte cr ON p.corte_id = cr.corte_id
      ORDER BY p.pelado_fecha DESC
    `);
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: "Error al consultar Pelado" });
  }
};

/* ============================================================
   GET por ID
   ============================================================ */
export const getPeladoxid = async (req, res) => {
  try {
    const [result] = await conmysql.query(`
      SELECT p.*, l.lote_codigo, u.usuario_nombre, cr.corte_descripcion
      FROM pelado p
      LEFT JOIN lote l ON p.lote_id = l.lote_id
      LEFT JOIN usuario u ON p.usuario_id = u.usuario_id
      LEFT JOIN corte cr ON p.corte_id = cr.corte_id
      WHERE p.pelado_id = ?
    `, [req.params.id]);

    if (result.length === 0)
      return res.status(404).json({ message: "Pelado no encontrado" });

    res.json(result[0]);

  } catch (error) {
    res.status(500).json({ message: "Error al servidor" });
  }
};

/* ============================================================
   POST: Pelado (consume sobrante del sublote COLA)
   ============================================================ */
export const postPelado = async (req, res) => {
  try {
    const {
      usuario_id,
      lote_id,
      corte_id,
      lbs_entrada,
      pelado_observaciones
    } = req.body;

    if (!usuario_id || !lote_id || !corte_id || !lbs_entrada)
      return res.status(400).json({ message: "Datos incompletos" });

    // Validar que sea COLA (tipo=2)
    const [lote] = await conmysql.query(`
      SELECT lote_codigo, lote_sobrante FROM lote WHERE lote_id = ? AND tipo_id = 2
    `, [lote_id]);

    if (!lote[0])
      return res.status(404).json({ message: "El lote no es COLA o no existe" });

    const sobranteActual = lote[0].lote_sobrante;

    if (lbs_entrada > sobranteActual)
      return res.status(400).json({ message: "Sobrante insuficiente en COLA" });

    // Insert pelado
    const fecha = new Date().toISOString().slice(0, 19).replace("T", " ");

    const [insert] = await conmysql.query(`
      INSERT INTO pelado (usuario_id, lote_id, corte_id, pelado_fecha, pelado_lbs_entrada, pelado_observaciones)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [usuario_id, lote_id, corte_id, fecha, lbs_entrada, pelado_observaciones]);

    const peladoId = insert.insertId;

    // Actualizar sobrante COLA
    const sobranteNuevo = sobranteActual - lbs_entrada;

    await conmysql.query(`
      UPDATE lote SET lote_sobrante = ? WHERE lote_id = ?
    `, [sobranteNuevo, lote_id]);

    // Crear sublote PELADO (tipo=3)
    const subCodigo = `SUB-${lote[0].lote_codigo}-PELADO`;

    const [sub] = await conmysql.query(`
      INSERT INTO lote (lote_codigo, parent_lote_id, tipo_id, lote_libras_remitidas, lote_sobrante)
      VALUES (?, ?, 3, ?, ?)
    `, [subCodigo, lote_id, lbs_entrada, lbs_entrada]);

    const subLoteId = sub.insertId;

    global._io.emit("pelado_nuevo", {
      pelado_id: peladoId,
      sublote_id: subLoteId
    });

    res.json({
      message: "Pelado registrado con éxito",
      pelado_id: peladoId,
      sublote_id: subLoteId,
      sobrante_restante: sobranteNuevo
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* ============================================================
   PUT: Actualizar completamente
   ============================================================ */
export const putPelado = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      usuario_id,
      lote_id,
      corte_id,
      pelado_lbs_entrada,
      pelado_observaciones
    } = req.body;

    const [result] = await conmysql.query(`
      UPDATE pelado SET
        usuario_id = ?, lote_id = ?, corte_id = ?, pelado_lbs_entrada = ?, pelado_observaciones = ?
      WHERE pelado_id = ?
    `, [usuario_id, lote_id, corte_id, pelado_lbs_entrada, pelado_observaciones, id]);

    if (result.affectedRows === 0)
      return res.status(404).json({ message: "Pelado no encontrado" });

    global._io.emit("pelado_actualizado", { pelado_id: id });

    res.json({ message: "Pelado actualizado" });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* ============================================================
   PATCH: Actualización parcial
   ============================================================ */
export const pathPelado = async (req, res) => {
  try {
    const { id } = req.params;

    const campos = Object.keys(req.body);
    const valores = Object.values(req.body);

    if (campos.length === 0)
      return res.status(400).json({ message: "No se enviaron campos" });

    const setClause = campos.map(c => `${c} = ?`).join(", ");

    const [result] = await conmysql.query(`
      UPDATE pelado SET ${setClause} WHERE pelado_id = ?
    `, [...valores, id]);

    if (result.affectedRows === 0)
      return res.status(404).json({ message: "Pelado no encontrado" });

    global._io.emit("pelado_actualizado", { pelado_id: id });

    res.json({ message: "Pelado actualizado parcialmente" });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* ============================================================
   DELETE
   ============================================================ */
export const deletePelado = async (req, res) => {
  try {
    const [result] = await conmysql.query(
      "DELETE FROM pelado WHERE pelado_id = ?",
      [req.params.id]
    );

    if (result.affectedRows === 0)
      return res.status(404).json({ message: "Pelado no encontrado" });

    global._io.emit("pelado_eliminado", { pelado_id: parseInt(req.params.id) });

    res.json({ message: "Pelado eliminado" });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

