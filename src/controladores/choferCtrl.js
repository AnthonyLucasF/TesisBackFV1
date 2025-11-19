import { conmysql } from "../db.js";

// SELECT: Obtener todos los registros ordenados alfabéticamente por nombre
export const getChofer = async (req, res) => {
    try {
        const [result] = await conmysql.query('SELECT * FROM chofer ORDER BY chofer_nombre ASC');
        res.json(result);
    } catch (error) {
        return res.status(500).json({ message: "Error al consultar Choferes" });
    }
};

// GET por ID with JOIN vehiculo_placa
export const getChoferxid = async (req, res) => {
    try {
        const [result] = await conmysql.query(`
      SELECT c.*, v.vehiculo_placa
      FROM chofer c
      LEFT JOIN vehiculo v ON c.vehiculo_id = v.vehiculo_id
      WHERE c.chofer_id = ?
    `, [req.params.id]);
        if (result.length <= 0) return res.status(404).json({ chofer_id: 0, message: "Chofer no encontrado" });
        res.json(result[0]);
    } catch (error) {
        return res.status(500).json({ message: "Error del Servidor" });
    }
};

// POST: Add vehiculo_id
export const postChofer = async (req, res) => {
    try {
        const { chofer_cedula, chofer_nombre, chofer_telefono, chofer_licencia, vehiculo_id } = req.body;
        if (chofer_cedula.length > 13) throw new Error("Cédula excede 13 caracteres"); //Revisar
        if (chofer_nombre.length > 100) throw new Error("Nombre excede 100 caracteres"); //Revisar
        if (chofer_telefono.length > 15) throw new Error("Teléfono excede 15 caracteres"); //Revisar
        if (chofer_licencia.length > 25) throw new Error("Licencia excede 25 caracteres"); //Revisar

        const [existing] = await conmysql.query('SELECT * FROM chofer WHERE chofer_cedula = ?', [chofer_cedula]); //Revisar
        if (existing.length > 0) return res.status(409).json({ message: "No se puede ingresar un chofer con una cédula ya existente" }); //Revisar

        const [rows] = await conmysql.query(
            'INSERT INTO chofer (chofer_cedula, chofer_nombre, chofer_telefono, chofer_licencia, vehiculo_id) VALUES (?, ?, ?, ?, ?)',
            [chofer_cedula, chofer_nombre, chofer_telefono, chofer_licencia, vehiculo_id]
        );

        res.json({ id: rows.insertId, message: "Chofer registrado con éxito" });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

// PUT: Update with vehiculo_id
export const putChofer = async (req, res) => {
    try {
        const { id } = req.params;
        const { chofer_cedula, chofer_nombre, chofer_telefono, chofer_licencia, vehiculo_id } = req.body;

        const [result] = await conmysql.query(
            'UPDATE chofer SET chofer_cedula=?, chofer_nombre=?, chofer_telefono=?, chofer_licencia=?, vehiculo_id=? WHERE chofer_id=?',
            [chofer_cedula, chofer_nombre, chofer_telefono, chofer_licencia, vehiculo_id, id]
        );

        if (result.affectedRows <= 0) return res.status(404).json({ message: "Chofer no encontrado" });

        const [rows] = await conmysql.query('SELECT * FROM chofer WHERE chofer_id=?', [id]);
        res.json(rows[0]);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

// PATCH: Partial with vehiculo_id
export const pathChofer = async (req, res) => {
    try {
        const { id } = req.params;
        const { chofer_cedula, chofer_nombre, chofer_telefono, chofer_licencia, vehiculo_id } = req.body;

        const [result] = await conmysql.query(
            `UPDATE chofer 
      SET chofer_cedula = IFNULL(?, chofer_cedula), 
          chofer_nombre = IFNULL(?, chofer_nombre), 
          chofer_telefono = IFNULL(?, chofer_telefono), 
          chofer_licencia = IFNULL(?, chofer_licencia),
          vehiculo_id = IFNULL(?, vehiculo_id)
      WHERE chofer_id = ?`,
            [chofer_cedula, chofer_nombre, chofer_telefono, chofer_licencia, vehiculo_id, id]
        );

        if (result.affectedRows <= 0) return res.status(404).json({ message: "Chofer no encontrado" });

        const [rows] = await conmysql.query('SELECT * FROM chofer WHERE chofer_id=?', [id]);
        res.json(rows[0]);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

// DELETE: Eliminar un registro
export const deleteChofer =
    async (req, res) => {
        try {
            const { id } = req.params;
            const [rows] = await conmysql.query('DELETE FROM chofer WHERE chofer_id=?', [id]);

            if (rows.affectedRows <= 0) return res.status(404).json({
                id: 0,
                message: "Chofer no encontrado"
            });

            res.status(202).json({ message: "Chofer eliminado con éxito" });
        } catch (error) {
            return res.status(500).json({ message: error.message });
        }
    };