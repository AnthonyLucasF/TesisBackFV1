import { conmysql } from "../db.js";

// SELECT: Obtener todos los registros ordenados alfabéticamente por nombre
export const getProveedor = async (req, res) => {
  try {
    const [result] = await conmysql.query('SELECT * FROM proveedor ORDER BY proveedor_nombre ASC');
    res.json(result);
  } catch (error) {
    return res.status(500).json({ message: "Error al consultar Proveedores" });
  }
};

// SELECT por ID (sin cambio)
export const getProveedorxid = async (req, res) => {
  try {
    const [result] = await conmysql.query('SELECT * FROM proveedor WHERE proveedor_id = ?', [req.params.id]);
    if (result.length <= 0) return res.status(404).json({
      proveedor_id: 0,
      message: "Proveedor no encontrado"
    });
    res.json(result[0]);
  } catch (error) {
    return res.status(500).json({ message: "Error del Servidor" });
  }
}

// INSERT: Crear un nuevo registro
export const postProveedor = async (req, res) => {
  try {
    const { proveedor_ruc, proveedor_codigo, proveedor_nombre, proveedor_camaronera, proveedor_contacto, proveedor_direccion } = req.body;
    if (proveedor_ruc.length > 13) throw new Error("RUC excede 13 caracteres"); //Revisar
    if (proveedor_camaronera.length > 100) throw new Error("Camaronera excede 100 caracteres"); //Revisar
    if (proveedor_contacto.length > 100) throw new Error("Contacto excede 100 caracteres"); //Revisar
    if (proveedor_direccion.length > 100) throw new Error("Dirección excede 100 caracteres"); //Revisar
    if (proveedor_codigo.length > 15) throw new Error("Código excede 15 caracteres"); //Revisar

    const [existing] = await conmysql.query('SELECT * FROM proveedor WHERE proveedor_ruc = ?', [proveedor_ruc]); //Revisar
    if (existing.length > 0) return res.status(409).json({ message: "No se puede ingresar un proveedor con un RUC ya existente" }); //Revisar

    const [rows] = await conmysql.query(
      'INSERT INTO proveedor (proveedor_ruc, proveedor_codigo, proveedor_nombre, proveedor_camaronera, proveedor_contacto, proveedor_direccion) VALUES (?, ?, ?, ?, ?, ?)',
      [proveedor_ruc, proveedor_codigo, proveedor_nombre, proveedor_camaronera, proveedor_contacto, proveedor_direccion]
    );
    res.json({ id: rows.insertId, message: "Proveedor registrado con éxito" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// UPDATE: Actualizar completo
export const putProveedor = async (req, res) => {
  try {
    const { id } = req.params;
    const { proveedor_ruc, proveedor_codigo, proveedor_nombre, proveedor_camaronera, proveedor_contacto, proveedor_direccion } = req.body;
    const [result] = await conmysql.query(
      'UPDATE proveedor SET proveedor_ruc=?, proveedor_codigo=?, proveedor_nombre=?, proveedor_camaronera=?, proveedor_contacto=?, proveedor_direccion=? WHERE proveedor_id = ?',
      [proveedor_ruc, proveedor_codigo, proveedor_nombre, proveedor_camaronera, proveedor_contacto, proveedor_direccion, id]
    );
    if (result.affectedRows <= 0) return res.status(404).json({ message: "Proveedor no encontrado" });
    const [rows] = await conmysql.query('SELECT * FROM proveedor WHERE proveedor_id = ?', [id]);
    res.json(rows[0]);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// UPDATE parcial
export const pathProveedor = async (req, res) => {
  try {
    const { id } = req.params;
    const { proveedor_ruc, proveedor_codigo, proveedor_nombre, proveedor_camaronera, proveedor_contacto, proveedor_direccion } = req.body;
    const [result] = await conmysql.query(
      `UPDATE proveedor 
       SET proveedor_ruc = IFNULL(?, proveedor_ruc), 
           proveedor_codigo = IFNULL(?, proveedor_codigo), 
           proveedor_nombre = IFNULL(?, proveedor_nombre), 
           proveedor_camaronera = IFNULL(?, proveedor_camaronera), 
           proveedor_contacto = IFNULL(?, proveedor_contacto), 
           proveedor_direccion = IFNULL(?, proveedor_direccion) 
       WHERE proveedor_id = ?`,
      [proveedor_ruc, proveedor_codigo, proveedor_nombre, proveedor_camaronera, proveedor_contacto, proveedor_direccion, id]
    );
    if (result.affectedRows <= 0) return res.status(404).json({ message: "Proveedor no encontrado" });
    const [rows] = await conmysql.query('SELECT * FROM proveedor WHERE proveedor_id = ?', [id]);
    res.json(rows[0]);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// DELETE
export const deleteProveedor = async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await conmysql.query('DELETE FROM proveedor WHERE proveedor_id = ?', [id]);
    if (rows.affectedRows <= 0) return res.status(404).json({ proveedor_id: 0, message: "Proveedor no encontrado" });
    res.status(202).json({ message: "Proveedor eliminado con éxito" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};