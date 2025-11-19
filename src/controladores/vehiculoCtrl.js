import { conmysql } from "../db.js";

// SELECT: Obtener todos los registros ordenados alfabéticamente por placa
export const getVehiculo = async (req, res) => {
    try {
        const [result] = await conmysql.query('SELECT * FROM vehiculo ORDER BY vehiculo_placa ASC');
        res.json(result);
    } catch (error) {
        return res.status(500).json({ message: "Error al consultar Vehículos" });
    }
};

// SELECT por ID (sin cambio)
export const getVehiculoxid = async (req, res) => {
    try {
        const [result] = await conmysql.query('SELECT * FROM vehiculo WHERE vehiculo_id = ?', [req.params.id]);
        if (result.length <= 0) return res.status(404).json({
            vehiculo_id: 0,
            message: "Vehículo no encontrado"
        });
        res.json(result[0]);
    } catch (error) {
        return res.status(500).json({ message: "Error del Servidor" });
    }
};

// INSERT: Crear un nuevo registro
export const postVehiculo =
    async (req, res) => {
        try {
            const { vehiculo_placa, vehiculo_tipo, vehiculo_capacidad } = req.body;
            if (vehiculo_placa.length > 10) throw new Error("Placa excede 10 caracteres"); //Revisar

            const [existing] = await conmysql.query('SELECT * FROM vehiculo WHERE vehiculo_placa = ?', [vehiculo_placa]); //Revisar
            if (existing.length > 0) return res.status(409).json({ message: "No se puede ingresar un vehículo con una placa ya existente" }); //Revisar

            const [rows] = await conmysql.query(
                'INSERT INTO vehiculo (vehiculo_placa, vehiculo_tipo, vehiculo_capacidad) VALUES (?, ?, ?)',
                [vehiculo_placa, vehiculo_tipo, vehiculo_capacidad]
            );

            res.json({
                id: rows.insertId,
                message: "Vehículo registrado con éxito"
            });
        } catch (error) {
            return res.status(500).json({ message: error.message });
        }
    };

// UPDATE: Actualizar un registro completo
export const putVehiculo =
    async (req, res) => {
        try {
            const { id } = req.params;
            const { vehiculo_placa, vehiculo_tipo, vehiculo_capacidad } = req.body;

            const [result] = await conmysql.query(
                'UPDATE vehiculo SET vehiculo_placa=?, vehiculo_tipo=?, vehiculo_capacidad=? WHERE vehiculo_id = ?',
                [vehiculo_placa, vehiculo_tipo, vehiculo_capacidad, id]
            );

            if (result.affectedRows <= 0) return res.status(404).json({ message: "Vehículo no encontrado" });

            const [rows] = await conmysql.query('SELECT * FROM vehiculo WHERE vehiculo_id=?', [id])

            res.json({
                success: true,
                message: "Vehículo registrado con éxito",
                data: { id: rows.insertId }
            });
        } catch (error) {
            return res.status(500).json({ message: error.message });
        }
    };

// UPDATE parcial: Actualizar algunos campos
export const pathVehiculo =
    async (req, res) => {
        try {
            const { id } = req.params;
            const { vehiculo_placa, vehiculo_tipo, vehiculo_capacidad } = req.body;

            const [result] = await conmysql.query(
                `UPDATE vehiculo 
            SET vehiculo_placa = IFNULL(?, vehiculo_placa), 
                vehiculo_tipo = IFNULL(?, vehiculo_tipo), 
                vehiculo_capacidad = IFNULL(?, vehiculo_capacidad)
            WHERE vehiculo_id=?`,
                [vehiculo_placa, vehiculo_tipo, vehiculo_capacidad, id]
            );

            if (result.affectedRows <= 0) return res.status(404).json({ message: "Vehículo no encontrado" });

            const [rows] = await conmysql.query('SELECT * FROM vehiculo WHERE vehiculo_id=?', [id])

            res.json({ message: "Vehículo actualizado parcialmente" });
        } catch (error) {
            return res.status(500).json({ message: error.message });
        }
    };

// DELETE: Eliminar un registro
export const deleteVehiculo =
    async (req, res) => {
        try {
            const { id } = req.params;
            const [rows] = await conmysql.query('DELETE FROM vehiculo WHERE vehiculo_id=?', [id]);

            if (rows.affectedRows <= 0) return res.status(404).json({
                id: 0,
                message: "Vehículo no encontrado"
            });

            res.status(202).json({ message: "Vehículo eliminado con éxito" });
        } catch (error) {
            return res.status(500).json({ message: error.message });
        }
    };
