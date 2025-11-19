import { conmysql } from "../db.js";

// GET: Todos con JOINs para lote y proveedor, ordenados por ID descendente (más reciente primero)
export const getDefectos = async (req, res) => {
  try {
    const [result] = await conmysql.query(`
      SELECT d.*, l.lote_codigo, p.proveedor_nombre AS lote_proveedor_nombre
      FROM defectos d
      LEFT JOIN lote l ON d.lote_id = l.lote_id
      LEFT JOIN proveedor p ON l.proveedor_id = p.proveedor_id
      ORDER BY d.defectos_id DESC
    `);
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: "Error al consultar Defectos" });
  }
};

// GET por ID with JOINs for lote, proveedor, usuario
export const getDefectosxid = async (req, res) => {
  try {
    const [result] = await conmysql.query(`
      SELECT d.*, l.lote_codigo, l.lote_libras_remitidas, p.proveedor_nombre AS lote_proveedor_nombre, u.usuario_nombre
      FROM defectos d
      LEFT JOIN lote l ON d.lote_id = l.lote_id
      LEFT JOIN proveedor p ON l.proveedor_id = p.proveedor_id
      LEFT JOIN usuario u ON d.usuario_id = u.usuario_id
      WHERE d.defectos_id = ?
    `, [req.params.id]);
    if (result.length === 0) return res.status(404).json({ defectos_id: 0, message: "Defecto no encontrado" });
    res.json(result[0]);
  } catch (error) {
    res.status(500).json({ message: "Error del Servidor" });
  }
};

// POST: Crear un nuevo registro
export const postDefectos = async (req, res) => {
  try {
    const data = req.body;

    if (!data.lote_id || !data.usuario_id) {
      return res.status(400).json({ message: "Faltan campos obligatorios (lote_id, usuario_id)" });
    }

    const campos = Object.keys(data).join(',');
    const valores = Object.values(data);
    const signos = valores.map(() => '?').join(',');

    const [insert] = await conmysql.query(
      `INSERT INTO defectos (${campos}) VALUES (${signos})`, valores
    );

    const nuevoId = insert.insertId;
    const anio = new Date().getFullYear();
    const codigo = `Df-${String(nuevoId).padStart(4, '0')}-${anio}`;

    await conmysql.query(
      `UPDATE defectos SET defectos_codigo=? WHERE defectos_id=?`,
      [codigo, nuevoId]
    );

    /*     const id = rows.insertId;
        const year = new Date().getFullYear();
        const code = `Df-${String(id).padStart(3, '0')}-${year}`;
    
        await conmysql.query('UPDATE defectos SET defectos_codigo = ? WHERE defectos_id = ?', [code, id]); */

    const [nuevoDefecto] = await conmysql.query(`
      SELECT d.*, l.lote_codigo, l.lote_libras_remitidas, p.proveedor_nombre AS lote_proveedor_nombre, u.usuario_nombre
      FROM defectos d
      LEFT JOIN lote l ON d.lote_id = l.lote_id
      LEFT JOIN proveedor p ON l.proveedor_id = p.proveedor_id
      LEFT JOIN usuario u ON d.usuario_id = u.usuario_id
      WHERE d.defectos_id = ?
    `, [nuevoId]);

    global._io.emit("defecto_nuevo", nuevoDefecto[0]);

    res.json(nuevoDefecto[0]);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// PUT: Actualizar completo (full replacement, sets missing fields to NULL, protects codigo)
export const putDefectos = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      defectos_cabeza_roja, defectos_cabeza_naranja, defectos_cabeza_floja, defectos_hepato_reventado, defectos_corbata,
      defectos_deformes, defectos_deshidratado_leve, defectos_deshidratado_moderado, defectos_deterioro, defectos_rojo,
      defectos_juvenil, defectos_flacido, defectos_mudado, defectos_mal_descabezado, defectos_mezclas_de_especies,
      defectos_necrosis_leve, defectos_necrosis_moderada, defectos_quebrado, defectos_pequenios, defectos_melanosis,
      defectos_3er_segmento_separado, defectos_porcentaje_cascara, defectos_porcentaje_intestino, defectos_porcentaje_sin_telon,
      defectos_porcentaje_falta_de_corte, defectos_porcentaje_corte_profundo, defectos_porcentaje_corte_desviado,
      defectos_basura, defectos_total_defectos, defectos_observaciones, defectos_acciones_correctivas,
      lote_id, usuario_id // defectos_codigo excluded to protect it
    } = req.body;

    // Required fields validation (align with POST)
    if (!usuario_id || !lote_id) {
      return res.status(400).json({ message: "Faltan campos obligatorios (usuario_id, lote_id)" });
    }

    const [result] = await conmysql.query(
      `UPDATE defectos SET 
        defectos_cabeza_roja=?, defectos_cabeza_naranja=?, defectos_cabeza_floja=?, defectos_hepato_reventado=?, defectos_corbata=?,
        defectos_deformes=?, defectos_deshidratado_leve=?, defectos_deshidratado_moderado=?, defectos_deterioro=?, defectos_rojo=?,
        defectos_juvenil=?, defectos_flacido=?, defectos_mudado=?, defectos_mal_descabezado=?, defectos_mezclas_de_especies=?,
        defectos_necrosis_leve=?, defectos_necrosis_moderada=?, defectos_quebrado=?, defectos_pequenios=?, defectos_melanosis=?,
        defectos_3er_segmento_separado=?, defectos_porcentaje_cascara=?, defectos_porcentaje_intestino=?, defectos_porcentaje_sin_telon=?,
        defectos_porcentaje_falta_de_corte=?, defectos_porcentaje_corte_profundo=?, defectos_porcentaje_corte_desviado=?,
        defectos_basura=?, defectos_total_defectos=?, defectos_observaciones=?, defectos_acciones_correctivas=?,
        lote_id=?, usuario_id=?
      WHERE defectos_id = ?`,
      [
        defectos_cabeza_roja, defectos_cabeza_naranja, defectos_cabeza_floja, defectos_hepato_reventado, defectos_corbata,
        defectos_deformes, defectos_deshidratado_leve, defectos_deshidratado_moderado, defectos_deterioro, defectos_rojo,
        defectos_juvenil, defectos_flacido, defectos_mudado, defectos_mal_descabezado, defectos_mezclas_de_especies,
        defectos_necrosis_leve, defectos_necrosis_moderada, defectos_quebrado, defectos_pequenios, defectos_melanosis,
        defectos_3er_segmento_separado, defectos_porcentaje_cascara, defectos_porcentaje_intestino, defectos_porcentaje_sin_telon,
        defectos_porcentaje_falta_de_corte, defectos_porcentaje_corte_profundo, defectos_porcentaje_corte_desviado,
        defectos_basura, defectos_total_defectos, defectos_observaciones, defectos_acciones_correctivas,
        lote_id, usuario_id, id
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Defecto no encontrado" });
    }

    const [rows] = await conmysql.query(`
      SELECT d.*, l.lote_codigo, l.lote_libras_remitidas, p.proveedor_nombre AS lote_proveedor_nombre, u.usuario_nombre
      FROM defectos d
      LEFT JOIN lote l ON d.lote_id = l.lote_id
      LEFT JOIN proveedor p ON l.proveedor_id = p.proveedor_id
      LEFT JOIN usuario u ON d.usuario_id = u.usuario_id
      WHERE d.defectos_id = ?
    `, [id]);
    global._io.emit("defecto_actualizado", rows[0]);

    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// PATCH: Actualización parcial (dynamic, allows setting to NULL, with protected fields filtered)
export const pathDefectos = async (req, res) => {
  try {
    const { id } = req.params;
    let data = req.body;

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ message: "No se enviaron campos para actualizar" });
    }

    // Filter out protected fields
    const protectedFields = ['defectos_id', 'defectos_codigo'];
    protectedFields.forEach(field => delete data[field]);

    const campos = Object.keys(data);
    if (campos.length === 0) {
      return res.status(400).json({ message: "No se enviaron campos válidos para actualizar" });
    }

    const valores = Object.values(data);

    const setClause = campos.map(campo => `${campo} = ?`).join(', ');

    const [result] = await conmysql.query(
      `UPDATE defectos SET ${setClause} WHERE defectos_id = ?`,
      [...valores, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Defecto no encontrado" });
    }

    const [rows] = await conmysql.query(`
      SELECT d.*, l.lote_codigo, l.lote_libras_remitidas, p.proveedor_nombre AS lote_proveedor_nombre, u.usuario_nombre
      FROM defectos d
      LEFT JOIN lote l ON d.lote_id = l.lote_id
      LEFT JOIN proveedor p ON l.proveedor_id = p.proveedor_id
      LEFT JOIN usuario u ON d.usuario_id = u.usuario_id
      WHERE d.defectos_id = ?
    `, [id]);
    global._io.emit("defecto_actualizado", rows[0]);

    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// DELETE
export const deleteDefectos = async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await conmysql.query('DELETE FROM defectos WHERE defectos_id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Defecto no encontrado" });
    }

    global._io.emit("defecto_eliminado", { defectos_id: parseInt(id, 10) });

    res.status(202).json({ message: "Defecto eliminado con éxito" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};