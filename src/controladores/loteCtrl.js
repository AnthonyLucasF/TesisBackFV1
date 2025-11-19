import { conmysql } from "../db.js";

// SELECT: Obtener todos los registros ordenados descendente por fecha
export const getLote = async (req, res) => {
    try {
        const [result] = await conmysql.query('SELECT * FROM lote ORDER BY lote_fecha_ingreso DESC');
        res.json(result);
    } catch (error) {
        return res.status(500).json({ message: "Error al consultar Lote (Materia Prima)" });
    }
};

// GET por ID with JOINs for nombres (tipo_descripcion, vehiculo_placa, chofer_nombre, proveedor_nombre, usuario_nombre)
export const getLotexid = async (req, res) => {
    try {
        const [result] = await conmysql.query(`
      SELECT l.*, 
        t.tipo_descripcion as lote_tipo_descripcion,
        v.vehiculo_placa as lote_vehiculo_placa,
        ch.chofer_nombre as lote_chofer_nombre,
        p.proveedor_nombre as lote_proveedor_nombre,
        u.usuario_nombre as lote_usuario_nombre

      FROM lote l
      LEFT JOIN tipo t ON l.tipo_id = t.tipo_id
      LEFT JOIN vehiculo v ON l.vehiculo_id = v.vehiculo_id
      LEFT JOIN chofer ch ON l.chofer_id = ch.chofer_id
      LEFT JOIN proveedor p ON l.proveedor_id = p.proveedor_id
      LEFT JOIN usuario u ON l.usuario_id = u.usuario_id

      WHERE l.lote_id = ?
    `, [req.params.id]);
        if (result.length <= 0) return res.status(404).json({ lote_id: 0, message: "Lote no encontrado" });
        res.json(result[0]);
    } catch (error) {
        return res.status(500).json({ message: "Error del Servidor" });
    }
};

// INSERT: Crear nuevo lote
export const postLote = async (req, res) => {

    try {
        const {
            tipo_id, vehiculo_id, chofer_id, lote_codigo, lote_fecha_ingreso, lote_hora_ingreso,
            proveedor_id, lote_libras_remitidas, lote_peso_promedio, lote_n_piscina, lote_n_bines,
            lote_n_gavetas_conicas, lote_n_gavetas_caladas, lote_n_sacos_hielo, lote_n_sacos_metasulfito,
            lote_n_sacos_sal, lote_observaciones, usuario_id
        } = req.body;

        if (!lote_codigo || !lote_fecha_ingreso || !usuario_id) {
            return res.status(400).json({ message: "Campos obligatorios faltantes" });
        }

        const [rows] = await conmysql.query(
            `INSERT INTO lote 
                (tipo_id, vehiculo_id, chofer_id, lote_codigo, lote_fecha_ingreso, lote_hora_ingreso,
                proveedor_id, lote_libras_remitidas, lote_peso_promedio, lote_n_piscina, lote_n_bines,
                lote_n_gavetas_conicas, lote_n_gavetas_caladas, lote_n_sacos_hielo, lote_n_sacos_metasulfito,
                lote_n_sacos_sal, lote_observaciones, usuario_id) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [tipo_id, vehiculo_id, chofer_id, lote_codigo, lote_fecha_ingreso, lote_hora_ingreso,
                proveedor_id, lote_libras_remitidas, lote_peso_promedio, lote_n_piscina, lote_n_bines,
                lote_n_gavetas_conicas, lote_n_gavetas_caladas, lote_n_sacos_hielo, lote_n_sacos_metasulfito,
                lote_n_sacos_sal, lote_observaciones, usuario_id]
        );

        const nuevoLote = { lote_id: rows.insertId, ...req.body };

        // 🔁 Emitir evento WebSocket
        global._io.emit("nuevo_lote", nuevoLote);

        res.json({
            id: rows.insertId,
            message: "Lote registrado con éxito"
        });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

// UPDATE completo
export const putLote = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            tipo_id, vehiculo_id, chofer_id, lote_codigo, lote_fecha_ingreso, lote_hora_ingreso,
            proveedor_id, lote_libras_remitidas, lote_peso_promedio, lote_n_piscina, lote_n_bines,
            lote_n_gavetas_conicas, lote_n_gavetas_caladas, lote_n_sacos_hielo, lote_n_sacos_metasulfito,
            lote_n_sacos_sal, lote_observaciones, usuario_id
        } = req.body;

        const [result] = await conmysql.query(
            `UPDATE lote SET 
                tipo_id=?, vehiculo_id=?, chofer_id=?, lote_codigo=?, lote_fecha_ingreso=?, lote_hora_ingreso=?,
                proveedor_id=?, lote_libras_remitidas=?, lote_peso_promedio=?, lote_n_piscina=?, lote_n_bines=?,
                lote_n_gavetas_conicas=?, lote_n_gavetas_caladas=?, lote_n_sacos_hielo=?, lote_n_sacos_metasulfito=?,
                lote_n_sacos_sal=?, lote_observaciones=?, usuario_id=?
            WHERE lote_id = ?`,
            [tipo_id, vehiculo_id, chofer_id, lote_codigo, lote_fecha_ingreso, lote_hora_ingreso,
                proveedor_id, lote_libras_remitidas, lote_peso_promedio, lote_n_piscina, lote_n_bines,
                lote_n_gavetas_conicas, lote_n_gavetas_caladas, lote_n_sacos_hielo, lote_n_sacos_metasulfito,
                lote_n_sacos_sal, lote_observaciones, usuario_id, id]
        );

        if (result.affectedRows <= 0) return res.status(404).json({ message: "Lote no encontrado" });

        const [rows] = await conmysql.query('SELECT * FROM lote WHERE lote_id=?', [id]);

        // 🔁 Emitir evento WebSocket
        global._io.emit("lote_actualizado", rows[0]);

        res.json(rows[0]);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

// PATCH parcial
export const pathLote = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            tipo_id, vehiculo_id, chofer_id, lote_codigo, lote_fecha_ingreso, lote_hora_ingreso,
            proveedor_id, lote_libras_remitidas, lote_peso_promedio, lote_n_piscina, lote_n_bines,
            lote_n_gavetas_conicas, lote_n_gavetas_caladas, lote_n_sacos_hielo, lote_n_sacos_metasulfito,
            lote_n_sacos_sal, lote_observaciones, usuario_id
        } = req.body;

        const [result] = await conmysql.query(
            `UPDATE lote SET
             tipo_id = IFNULL(?, tipo_id), vehiculo_id = IFNULL(?, vehiculo_id), chofer_id = IFNULL(?, chofer_id),
             lote_codigo = IFNULL(?, lote_codigo), lote_fecha_ingreso = IFNULL(?, lote_fecha_ingreso),
             lote_hora_ingreso = IFNULL(?, lote_hora_ingreso), proveedor_id = IFNULL(?, proveedor_id),
             lote_libras_remitidas = IFNULL(?, lote_libras_remitidas), lote_peso_promedio = IFNULL(?, lote_peso_promedio),
             lote_n_piscina = IFNULL(?, lote_n_piscina), lote_n_bines = IFNULL(?, lote_n_bines),
             lote_n_gavetas_conicas = IFNULL(?, lote_n_gavetas_conicas), lote_n_gavetas_caladas = IFNULL(?, lote_n_gavetas_caladas),
             lote_n_sacos_hielo = IFNULL(?, lote_n_sacos_hielo), lote_n_sacos_metasulfito = IFNULL(?, lote_n_sacos_metasulfito),
             lote_n_sacos_sal = IFNULL(?, lote_n_sacos_sal), lote_observaciones = IFNULL(?, lote_observaciones),
             usuario_id = IFNULL(?, usuario_id)
             WHERE lote_id = ?`,
            [tipo_id, vehiculo_id, chofer_id, lote_codigo, lote_fecha_ingreso, lote_hora_ingreso,
                proveedor_id, lote_libras_remitidas, lote_peso_promedio, lote_n_piscina, lote_n_bines,
                lote_n_gavetas_conicas, lote_n_gavetas_caladas, lote_n_sacos_hielo, lote_n_sacos_metasulfito,
                lote_n_sacos_sal, lote_observaciones, usuario_id, id]
        );

        if (result.affectedRows <= 0) return res.status(404).json({ message: "Lote no encontrado" });

        const [rows] = await conmysql.query('SELECT * FROM lote WHERE lote_id=?', [id]);

        // 🔁 Emitir evento WebSocket
        global._io.emit("lote_actualizado", rows[0]);

        res.json(rows[0]);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

// DELETE
export const deleteLote = async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await conmysql.query('DELETE FROM lote WHERE lote_id=?', [id]);

        if (rows.affectedRows <= 0) return res.status(404).json({ id: 0, message: "Lote no encontrado" });

        res.status(202).json({ message: "Lote eliminado con éxito" });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};
