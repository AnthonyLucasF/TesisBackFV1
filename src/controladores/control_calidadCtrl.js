/* import { conmysql } from "../db.js";

// GET: Obtener todos ordenados descendente por hora (JOIN lote para fecha si needed)
export const getControl_Calidad = async (req, res) => {
  try {
    const [result] = await conmysql.query(`
      SELECT cc.*, l.lote_codigo, l.lote_fecha_ingreso
      FROM control_calidad cc
      LEFT JOIN lote l ON cc.lote_id = l.lote_id
      ORDER BY l.lote_fecha_ingreso DESC, cc.c_calidad_hora_control DESC
    `);
    res.json(result);
  } catch (error) {
    return res.status(500).json({ message: "Error al consultar Control de Calidad" });
  }
};

// GET listado con proveedor
// export const getControl_Calidad = async (req, res) => {
// try {
//     const [result] = await conmysql.query(`
//     SELECT cc.*, l.lote_codigo, l.lote_fecha_ingreso,
//     p.proveedor_nombre, d.defectos_lote_id
//     FROM control_calidad cc
//     LEFT JOIN lote l ON cc.lote_id = l.lote_id
//     LEFT JOIN proveedor p ON cc.proveedor_id = p.proveedor_id
//     LEFT JOIN defectos d ON cc.defectos_id = d.defectos_id
//    ORDER BY l.lote_fecha_ingreso DESC, cc.c_calidad_hora_control DESC
//  `);
//  res.json(result);
//} catch (error) {
//  res.status(500).json({ message: error.message });
//}
//};

// GET por ID with JOINs for lote, proveedor, usuario
export const getControl_Calidadxid = async (req, res) => {
  try {
    const [result] = await conmysql.query(`
      SELECT cc.*, l.lote_codigo, l.lote_libras_remitidas, p.proveedor_nombre, u.usuario_nombre
      FROM control_calidad cc
      LEFT JOIN lote l ON cc.lote_id = l.lote_id
      LEFT JOIN proveedor p ON l.proveedor_id = p.proveedor_id
      LEFT JOIN usuario u ON cc.usuario_id = u.usuario_id
      WHERE cc.c_calidad_id = ?
    `, [req.params.id]);
    if (result.length <= 0) return res.status(404).json({ c_calidad_id: 0, message: "Control de Calidad no encontrado" });
    res.json(result[0]);
  } catch (error) {
    return res.status(500).json({ message: "Error del Servidor" });
  }
};

// POST: Insertar nuevo registro (sin cambios, ya bien)
export const postControl_Calidad = async (req, res) => {
  try {
    const {
      usuario_id, lote_id, tipo_id, clase_id,
      c_calidad_hora_control, c_calidad_talla_real, c_calidad_talla_marcada,
      c_calidad_peso_bruto, c_calidad_peso_neto, c_calidad_cuenta_x_libra,
      c_calidad_total, c_calidad_uniformidad, c_calidad_olor, c_calidad_sabor,
      c_calidad_observaciones, defectos_id, color_id
    } = req.body;

    if (!usuario_id || !lote_id || !tipo_id || !clase_id) {
      return res.status(400).json({ message: "Faltan campos obligatorios" });
    }

    const horaControl = c_calidad_hora_control || new Date().toTimeString().slice(0, 8);

    const [insert] = await conmysql.query(
      `INSERT INTO control_calidad 
      (usuario_id, lote_id, tipo_id, clase_id, c_calidad_hora_control, c_calidad_talla_real,
       c_calidad_talla_marcada, c_calidad_peso_bruto, c_calidad_peso_neto, c_calidad_cuenta_x_libra,
       c_calidad_total, c_calidad_uniformidad, c_calidad_olor, c_calidad_sabor,
       c_calidad_observaciones, defectos_id, color_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        usuario_id, lote_id, tipo_id, clase_id, horaControl,
        c_calidad_talla_real, c_calidad_talla_marcada,
        c_calidad_peso_bruto, c_calidad_peso_neto, c_calidad_cuenta_x_libra,
        c_calidad_total, c_calidad_uniformidad, c_calidad_olor, c_calidad_sabor,
        c_calidad_observaciones, defectos_id, color_id
      ]
    );

    const nuevoId = insert.insertId;
    const anio = new Date().getFullYear();
    const codigo = `Cc-${String(nuevoId).padStart(4, '0')}-${anio}`;

    // Actualizar código
    await conmysql.query(
      `UPDATE control_calidad SET c_calidad_codigo=? WHERE c_calidad_id=?`,
      [codigo, nuevoId]
    );

    const [nuevoRegistro] = await conmysql.query('SELECT * FROM control_calidad WHERE c_calidad_id=?', [nuevoId]);

    global._io.emit("control_calidad_nuevo", nuevoRegistro[0]);

    res.json({ id: nuevoId, message: "Control de Calidad registrado con éxito", codigo });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// PUT: Actualizar completo (sin cambios)
export const putControl_Calidad = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      usuario_id, lote_id, tipo_id, clase_id,
      c_calidad_hora_control, c_calidad_talla_real, c_calidad_talla_marcada,
      c_calidad_peso_bruto, c_calidad_peso_neto, c_calidad_cuenta_x_libra,
      c_calidad_total, c_calidad_uniformidad, c_calidad_olor, c_calidad_sabor,
      c_calidad_observaciones, defectos_id, color_id
    } = req.body;

    const [result] = await conmysql.query(
      `UPDATE control_calidad SET 
        usuario_id=?, lote_id=?, tipo_id=?, clase_id=?, c_calidad_hora_control=?, c_calidad_talla_real=?,
        c_calidad_talla_marcada=?, c_calidad_peso_bruto=?, c_calidad_peso_neto=?, c_calidad_cuenta_x_libra=?,
        c_calidad_total=?, c_calidad_uniformidad=?, c_calidad_olor=?, c_calidad_sabor=?, c_calidad_observaciones=?,
        defectos_id=?, color_id=?
      WHERE c_calidad_id=?`,
      [
        usuario_id, lote_id, tipo_id, clase_id,
        c_calidad_hora_control, c_calidad_talla_real, c_calidad_talla_marcada,
        c_calidad_peso_bruto, c_calidad_peso_neto, c_calidad_cuenta_x_libra,
        c_calidad_total, c_calidad_uniformidad, c_calidad_olor, c_calidad_sabor,
        c_calidad_observaciones, defectos_id, color_id, id
      ]
    );

    if (result.affectedRows <= 0)
      return res.status(404).json({ message: "Control de Calidad no encontrado" });

    const [rows] = await conmysql.query('SELECT * FROM control_calidad WHERE c_calidad_id=?', [id]);
    global._io.emit("control_calidad_actualizado", rows[0]);

    res.json(rows[0]);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// PATCH: Actualización parcial
export const pathControl_Calidad = async (req, res) => {
  try {
    const { id } = req.params;
    const campos = Object.keys(req.body);
    const valores = Object.values(req.body);

    if (campos.length === 0)
      return res.status(400).json({ message: "No se enviaron campos para actualizar" });

    const setClause = campos.map(c => `${c} = IFNULL(?, ${c})`).join(', ');
    const [result] = await conmysql.query(
      `UPDATE control_calidad SET ${setClause} WHERE c_calidad_id = ?`,
      [...valores, id]
    );

    if (result.affectedRows <= 0)
      return res.status(404).json({ message: "Control de Calidad no encontrado" });

    const [rows] = await conmysql.query('SELECT * FROM control_calidad WHERE c_calidad_id=?', [id]);
    global._io.emit("control_calidad_actualizado", rows[0]);

    res.json(rows[0]);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// DELETE
export const deleteControl_Calidad = async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await conmysql.query('DELETE FROM control_calidad WHERE c_calidad_id=?', [id]);

    if (rows.affectedRows <= 0)
      return res.status(404).json({ id: 0, message: "Control de Calidad no encontrado" });

    global._io.emit("control_calidad_eliminado", { c_calidad_id: parseInt(id) });
    res.status(202).json({ message: "Control de Calidad eliminado con éxito" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
 */


import { conmysql } from "../db.js";

// GET: todos
export const getControl_Calidad = async (req, res) => {
  try {
    const [rows] = await conmysql.query(`
      SELECT cc.*, l.lote_codigo, l.lote_libras_remitidas, p.proveedor_nombre, u.usuario_nombre, d.defectos_codigo
      FROM control_calidad cc
      LEFT JOIN lote l ON cc.lote_id = l.lote_id
      LEFT JOIN proveedor p ON l.proveedor_id = p.proveedor_id
      LEFT JOIN usuario u ON cc.usuario_id = u.usuario_id
      LEFT JOIN defectos d ON cc.defectos_id = d.defectos_id
      ORDER BY l.lote_fecha_ingreso DESC, cc.c_calidad_hora_control DESC
    `);
    res.json(rows);
  } catch (error) {
    return res.status(500).json({ message: "Error al consultar Control de Calidad" });
  }
};

// GET por ID
export const getControl_Calidadxid = async (req, res) => {
  try {
    const [rows] = await conmysql.query(`
      SELECT cc.*, l.lote_codigo, l.lote_libras_remitidas, p.proveedor_nombre, u.usuario_nombre, d.defectos_codigo
      FROM control_calidad cc
      LEFT JOIN lote l ON cc.lote_id = l.lote_id
      LEFT JOIN proveedor p ON l.proveedor_id = p.proveedor_id
      LEFT JOIN usuario u ON cc.usuario_id = u.usuario_id
      LEFT JOIN defectos d ON cc.defectos_id = d.defectos_id
      WHERE cc.c_calidad_id = ?
    `, [req.params.id]);

    if (rows.length === 0) return res.status(404).json({ c_calidad_id: 0, message: "Control de Calidad no encontrado" });
    res.json(rows[0]);
  } catch (error) {
    return res.status(500).json({ message: "Error del Servidor" });
  }
};

// POST: crear nuevo registro con código automático
/* export const postControl_Calidad = async (req, res) => {
  try {
    const data = req.body;

    // Campos obligatorios
    const required = ['usuario_id', 'lote_id', 'tipo_id', 'clase_id'];
    for (const f of required) if (!data[f]) return res.status(400).json({ message: `Falta el campo obligatorio: ${f}` });

    const campos = Object.keys(data);
    const valores = Object.values(data);
    const placeholders = valores.map(() => '?').join(',');

    const [insert] = await conmysql.query(
      `INSERT INTO control_calidad (${campos.join(',')}) VALUES (${placeholders})`,
      valores
    );

    const nuevoId = insert.insertId;
    const anio = new Date().getFullYear();
    const codigo = `Cc-${String(nuevoId).padStart(4, '0')}-${anio}`;

    await conmysql.query(`UPDATE control_calidad SET c_calidad_codigo=? WHERE c_calidad_id=?`, [codigo, nuevoId]);

    const [nuevoRegistro] = await conmysql.query(`
      SELECT cc.*, l.lote_codigo, l.lote_libras_remitidas, p.proveedor_nombre, u.usuario_nombre
      FROM control_calidad cc
      LEFT JOIN lote l ON cc.lote_id = l.lote_id
      LEFT JOIN proveedor p ON l.proveedor_id = p.proveedor_id
      LEFT JOIN usuario u ON cc.usuario_id = u.usuario_id
      WHERE cc.c_calidad_id = ?
    `, [nuevoId]);

    global._io.emit("control_calidad_nuevo", nuevoRegistro[0]);
    res.json(nuevoRegistro[0]);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}; */

// POST: crear nuevo registro con código automático
export const postControl_Calidad = async (req, res) => {
  console.log("POST /control_calidad data:", req.body);

  try {
    const data = req.body;

    // --- 1. Validar campos obligatorios ---
    const required = ['usuario_id', 'lote_id', 'tipo_id', 'clase_id'];
    for (const f of required) {
      if (!data[f]) {
        return res.status(400).json({ message: `Falta el campo obligatorio: ${f}` });
      }
    }

    // --- 2. Definir campos que vamos a insertar ---
    const camposInsert = [
      'usuario_id', 'lote_id', 'tipo_id', 'clase_id',
      'c_calidad_hora_control', 'c_calidad_talla_real', 'c_calidad_talla_marcada',
      'c_calidad_peso_bruto', 'c_calidad_peso_neto', 'c_calidad_cuenta_x_libra',
      'c_calidad_total', 'c_calidad_uniformidad', 'c_calidad_olor', 'c_calidad_sabor',
      'c_calidad_observaciones', 'defectos_id', 'color_id'
    ];

    const valores = camposInsert.map(c => data[c] !== undefined ? data[c] : null);

    // --- 3. Insertar registro ---
    const [insert] = await conmysql.query(
      `INSERT INTO control_calidad (${camposInsert.join(',')}) VALUES (${camposInsert.map(() => '?').join(',')})`,
      valores
    );

    const nuevoId = insert.insertId;
    if (!nuevoId) {
      return res.status(500).json({ message: "No se pudo generar el nuevo registro" });
    }

    // --- 4. Generar código automático ---
    const anio = new Date().getFullYear();
    const codigo = `Cc-${String(nuevoId).padStart(4, '0')}-${anio}`;

    await conmysql.query(
      `UPDATE control_calidad SET c_calidad_codigo=? WHERE c_calidad_id=?`,
      [codigo, nuevoId]
    );

    // --- 5. Traer registro completo con joins ---
    const [nuevoRegistro] = await conmysql.query(`
      SELECT cc.*, l.lote_codigo, l.lote_libras_remitidas, p.proveedor_nombre, u.usuario_nombre
      FROM control_calidad cc
      LEFT JOIN lote l ON cc.lote_id = l.lote_id
      LEFT JOIN proveedor p ON l.proveedor_id = p.proveedor_id
      LEFT JOIN usuario u ON cc.usuario_id = u.usuario_id
      WHERE cc.c_calidad_id = ?
    `, [nuevoId]);

    // --- 6. Emitir evento socket y responder ---
    if (global._io) {
      global._io.emit("control_calidad_nuevo", nuevoRegistro[0]);
    }

    res.status(201).json(nuevoRegistro[0]);

  } catch (error) {
    console.error("Error en postControl_Calidad:", error);
    return res.status(500).json({ message: error.message });
  }
};

// PUT: actualización completa
export const putControl_Calidad = async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;

    const campos = Object.keys(data);
    const valores = Object.values(data);
    const setClause = campos.map(c => `${c}=?`).join(',');

    const [result] = await conmysql.query(`UPDATE control_calidad SET ${setClause} WHERE c_calidad_id=?`, [...valores, id]);

    if (result.affectedRows === 0) return res.status(404).json({ message: "Control de Calidad no encontrado" });

    const [rows] = await conmysql.query(`
      SELECT cc.*, l.lote_codigo, l.lote_libras_remitidas, p.proveedor_nombre, u.usuario_nombre
      FROM control_calidad cc
      LEFT JOIN lote l ON cc.lote_id = l.lote_id
      LEFT JOIN proveedor p ON l.proveedor_id = p.proveedor_id
      LEFT JOIN usuario u ON cc.usuario_id = u.usuario_id
      WHERE cc.c_calidad_id = ?
    `, [id]);

    global._io.emit("control_calidad_actualizado", rows[0]);
    res.json(rows[0]);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// PATCH: actualización parcial
export const pathControl_Calidad = async (req, res) => {
  try {
    const { id } = req.params;
    let data = req.body;

    if (Object.keys(data).length === 0) return res.status(400).json({ message: "No se enviaron campos para actualizar" });

    const protectedFields = ['c_calidad_id','c_calidad_codigo'];
    protectedFields.forEach(f => delete data[f]);

    const campos = Object.keys(data);
    const valores = Object.values(data);
    if (campos.length === 0) return res.status(400).json({ message: "No se enviaron campos válidos para actualizar" });

    const setClause = campos.map(c => `${c}=?`).join(',');

    const [result] = await conmysql.query(`UPDATE control_calidad SET ${setClause} WHERE c_calidad_id=?`, [...valores, id]);

    if (result.affectedRows === 0) return res.status(404).json({ message: "Control de Calidad no encontrado" });

    const [rows] = await conmysql.query(`
      SELECT cc.*, l.lote_codigo, l.lote_libras_remitidas, p.proveedor_nombre, u.usuario_nombre
      FROM control_calidad cc
      LEFT JOIN lote l ON cc.lote_id = l.lote_id
      LEFT JOIN proveedor p ON l.proveedor_id = p.proveedor_id
      LEFT JOIN usuario u ON cc.usuario_id = u.usuario_id
      WHERE cc.c_calidad_id = ?
    `, [id]);

    global._io.emit("control_calidad_actualizado", rows[0]);
    res.json(rows[0]);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// DELETE
export const deleteControl_Calidad = async (req, res) => {
  try {
    const { id } = req.params;
    const [result] = await conmysql.query(`DELETE FROM control_calidad WHERE c_calidad_id=?`, [id]);

    if (result.affectedRows === 0) return res.status(404).json({ message: "Control de Calidad no encontrado" });

    global._io.emit("control_calidad_eliminado", { c_calidad_id: parseInt(id, 10) });
    res.status(202).json({ message: "Control de Calidad eliminado con éxito" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
