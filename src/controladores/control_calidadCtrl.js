import { conmysql } from "../db.js";

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
/* export const getControl_Calidad = async (req, res) => {
  try {
    const [result] = await conmysql.query(`
      SELECT cc.*, l.lote_codigo, l.lote_fecha_ingreso,
      p.proveedor_nombre, d.defectos_lote_id
      FROM control_calidad cc
      LEFT JOIN lote l ON cc.lote_id = l.lote_id
      LEFT JOIN proveedor p ON cc.proveedor_id = p.proveedor_id
      LEFT JOIN defectos d ON cc.defectos_id = d.defectos_id
      ORDER BY l.lote_fecha_ingreso DESC, cc.c_calidad_hora_control DESC
    `);
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}; */

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
    const codigo = `Cc-${String(nuevoId).padStart(3, '0')}-${anio}`;

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

/* export const postControl_Calidad = async (req, res) => {
  try {
    const data = req.body;

    // Validación de campos obligatorios
    const requiredFields = ['usuario_id', 'lote_id', 'tipo_id', 'clase_id'];
    for (const field of requiredFields) {
      if (!data[field]) {
        return res.status(400).json({ message: `Falta el campo obligatorio: ${field}` });
      }
    }

    // Convertir undefined a NULL
    const campos = Object.keys(data);
    const valores = campos.map(c => data[c] !== undefined ? data[c] : null);
    const signos = campos.map(() => '?').join(',');

    const [insert] = await conmysql.query(
      `INSERT INTO control_calidad (${campos.join(',')}) VALUES (${signos})`,
      valores
    );

    const nuevoId = insert.insertId;
    const anio = new Date().getFullYear();
    const codigo = `Cc-${String(nuevoId).padStart(3, '0')}-${anio}`;

    await conmysql.query(
      `UPDATE control_calidad SET c_calidad_codigo=? WHERE c_calidad_id=?`,
      [codigo, nuevoId]
    );

    const [nuevoRegistro] = await conmysql.query(
      'SELECT * FROM control_calidad WHERE c_calidad_id=?', 
      [nuevoId]
    );

    global._io.emit("control_calidad_nuevo", nuevoRegistro[0]);
    res.json(nuevoRegistro[0]);
  } catch (error) {
    console.error('Error POST control_calidad:', error);
    res.status(500).json({ message: error.message });
  }
}; */

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
