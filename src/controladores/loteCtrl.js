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
/* export const postLote = async (req, res) => {

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
}; */

export const postLote = async (req, res) => {
    try {
        let {
            tipo_id, vehiculo_id, chofer_id, lote_codigo, lote_fecha_ingreso, lote_hora_ingreso,
            proveedor_id, lote_libras_remitidas, lote_peso_promedio, lote_n_piscina, lote_n_bines,
            lote_n_gavetas_conicas, lote_n_gavetas_caladas, lote_n_sacos_hielo, lote_n_sacos_metasulfito,
            lote_n_sacos_sal, lote_observaciones, usuario_id
        } = req.body;

        // Normaliza vacíos que suelen venir de Ionic ("")
        const toNullInt = (v) => (v === '' || v === undefined || v === null ? null : Number(v));
        tipo_id = toNullInt(tipo_id);
        chofer_id = toNullInt(chofer_id);
        vehiculo_id = toNullInt(vehiculo_id);
        proveedor_id = toNullInt(proveedor_id);
        usuario_id = toNullInt(usuario_id);

        if (!lote_codigo || !lote_fecha_ingreso || !usuario_id) {
            return res.status(400).json({ message: "Campos obligatorios faltantes" });
        }

        // Si el chofer está seleccionado, el vehículo se obtiene desde la BD
        if (chofer_id && !vehiculo_id) {
            const [ch] = await conmysql.query(
                'SELECT vehiculo_id FROM chofer WHERE chofer_id = ?',
                [chofer_id]
            );
            if (ch.length === 0) return res.status(400).json({ message: "Chofer no existe" });
            vehiculo_id = ch[0].vehiculo_id;
            if (!vehiculo_id) return res.status(400).json({ message: "Chofer no tiene vehículo asignado" });
        }

        // Si te mandan vehiculo_id, valida que coincida con el chofer
        if (chofer_id && vehiculo_id) {
            const [ok] = await conmysql.query(
                'SELECT 1 FROM chofer WHERE chofer_id = ? AND vehiculo_id = ?',
                [chofer_id, vehiculo_id]
            );
            if (ok.length === 0) {
                return res.status(400).json({ message: "El vehículo no corresponde al chofer seleccionado" });
            }
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

        const nuevoLote = { lote_id: rows.insertId, ...req.body, vehiculo_id };
        global._io.emit("nuevo_lote", nuevoLote);

        res.json({ id: rows.insertId, message: "Lote registrado con éxito" });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

// UPDATE completo
/* export const putLote = async (req, res) => {
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
}; */

export const putLote = async (req, res) => {
    try {
        const { id } = req.params;

        let {
            tipo_id, vehiculo_id, chofer_id, lote_codigo, lote_fecha_ingreso, lote_hora_ingreso,
            proveedor_id, lote_libras_remitidas, lote_peso_promedio, lote_n_piscina, lote_n_bines,
            lote_n_gavetas_conicas, lote_n_gavetas_caladas, lote_n_sacos_hielo, lote_n_sacos_metasulfito,
            lote_n_sacos_sal, lote_observaciones, usuario_id
        } = req.body;

        // Normaliza vacíos típicos de Ionic ("")
        const toNullInt = (v) => (v === '' || v === undefined || v === null ? null : Number(v));

        tipo_id = toNullInt(tipo_id);
        chofer_id = toNullInt(chofer_id);
        vehiculo_id = toNullInt(vehiculo_id);
        proveedor_id = toNullInt(proveedor_id);
        usuario_id = toNullInt(usuario_id);

        // Si el chofer está definido, el vehículo se obtiene desde la BD
        // (así no dependes de que el front mande vehiculo_id)
        if (chofer_id) {
            const [ch] = await conmysql.query(
                'SELECT vehiculo_id FROM chofer WHERE chofer_id = ?',
                [chofer_id]
            );
            if (ch.length === 0) return res.status(400).json({ message: "Chofer no existe" });

            const vehiculoChofer = ch[0].vehiculo_id;
            if (!vehiculoChofer) return res.status(400).json({ message: "Chofer no tiene vehículo asignado" });

            // Si mandan vehiculo_id y NO coincide, rechaza (evita incoherencias)
            if (vehiculo_id && vehiculo_id !== vehiculoChofer) {
                return res.status(400).json({ message: "El vehículo no corresponde al chofer seleccionado" });
            }

            vehiculo_id = vehiculoChofer;
        }

        // UPDATE completo
        const [result] = await conmysql.query(
            `UPDATE lote SET
        tipo_id=?, vehiculo_id=?, chofer_id=?, lote_codigo=?, lote_fecha_ingreso=?, lote_hora_ingreso=?,
        proveedor_id=?, lote_libras_remitidas=?, lote_peso_promedio=?, lote_n_piscina=?, lote_n_bines=?,
        lote_n_gavetas_conicas=?, lote_n_gavetas_caladas=?, lote_n_sacos_hielo=?, lote_n_sacos_metasulfito=?,
        lote_n_sacos_sal=?, lote_observaciones=?, usuario_id=?
      WHERE lote_id = ?`,
            [
                tipo_id, vehiculo_id, chofer_id, lote_codigo, lote_fecha_ingreso, lote_hora_ingreso,
                proveedor_id, lote_libras_remitidas, lote_peso_promedio, lote_n_piscina, lote_n_bines,
                lote_n_gavetas_conicas, lote_n_gavetas_caladas, lote_n_sacos_hielo, lote_n_sacos_metasulfito,
                lote_n_sacos_sal, lote_observaciones, usuario_id, id
            ]
        );

        if (result.affectedRows <= 0) return res.status(404).json({ message: "Lote no encontrado" });

        const [rows] = await conmysql.query('SELECT * FROM lote WHERE lote_id=?', [id]);
        global._io.emit("lote_actualizado", rows[0]);

        res.json(rows[0]);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

// PATCH parcial
/* export const pathLote = async (req, res) => {
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
}; */

export const pathLote = async (req, res) => {
    try {
        const { id } = req.params;

        let {
            tipo_id, vehiculo_id, chofer_id, lote_codigo, lote_fecha_ingreso, lote_hora_ingreso,
            proveedor_id, lote_libras_remitidas, lote_peso_promedio, lote_n_piscina, lote_n_bines,
            lote_n_gavetas_conicas, lote_n_gavetas_caladas, lote_n_sacos_hielo, lote_n_sacos_metasulfito,
            lote_n_sacos_sal, lote_observaciones, usuario_id
        } = req.body;

        const toNullInt = (v) => (v === '' || v === undefined || v === null ? null : Number(v));

        // Normaliza enteros solo si vienen
        tipo_id = tipo_id !== undefined ? toNullInt(tipo_id) : undefined;
        chofer_id = chofer_id !== undefined ? toNullInt(chofer_id) : undefined;
        vehiculo_id = vehiculo_id !== undefined ? toNullInt(vehiculo_id) : undefined;
        proveedor_id = proveedor_id !== undefined ? toNullInt(proveedor_id) : undefined;
        usuario_id = usuario_id !== undefined ? toNullInt(usuario_id) : undefined;

        // Si intentan cambiar vehículo sin cambiar chofer, rechaza (por tu regla de negocio)
        if (vehiculo_id !== undefined && chofer_id === undefined) {
            return res.status(400).json({
                message: "No se permite cambiar vehículo directamente. Selecciona un chofer (el vehículo se asigna automáticamente)."
            });
        }

        // Si mandan chofer_id, derivamos vehiculo_id desde BD y validamos
        if (chofer_id !== undefined && chofer_id !== null) {
            const [ch] = await conmysql.query(
                'SELECT vehiculo_id FROM chofer WHERE chofer_id = ?',
                [chofer_id]
            );
            if (ch.length === 0) return res.status(400).json({ message: "Chofer no existe" });

            const vehiculoChofer = ch[0].vehiculo_id;
            if (!vehiculoChofer) return res.status(400).json({ message: "Chofer no tiene vehículo asignado" });

            // Si mandan vehiculo_id, debe coincidir
            if (vehiculo_id !== undefined && vehiculo_id !== null && vehiculo_id !== vehiculoChofer) {
                return res.status(400).json({ message: "El vehículo no corresponde al chofer seleccionado" });
            }

            // Forzamos el vehículo correcto
            vehiculo_id = vehiculoChofer;
        }

        const [result] = await conmysql.query(
            `UPDATE lote SET
        tipo_id = IFNULL(?, tipo_id),
        vehiculo_id = IFNULL(?, vehiculo_id),
        chofer_id = IFNULL(?, chofer_id),
        lote_codigo = IFNULL(?, lote_codigo),
        lote_fecha_ingreso = IFNULL(?, lote_fecha_ingreso),
        lote_hora_ingreso = IFNULL(?, lote_hora_ingreso),
        proveedor_id = IFNULL(?, proveedor_id),
        lote_libras_remitidas = IFNULL(?, lote_libras_remitidas),
        lote_peso_promedio = IFNULL(?, lote_peso_promedio),
        lote_n_piscina = IFNULL(?, lote_n_piscina),
        lote_n_bines = IFNULL(?, lote_n_bines),
        lote_n_gavetas_conicas = IFNULL(?, lote_n_gavetas_conicas),
        lote_n_gavetas_caladas = IFNULL(?, lote_n_gavetas_caladas),
        lote_n_sacos_hielo = IFNULL(?, lote_n_sacos_hielo),
        lote_n_sacos_metasulfito = IFNULL(?, lote_n_sacos_metasulfito),
        lote_n_sacos_sal = IFNULL(?, lote_n_sacos_sal),
        lote_observaciones = IFNULL(?, lote_observaciones),
        usuario_id = IFNULL(?, usuario_id)
      WHERE lote_id = ?`,
            [
                tipo_id ?? null,
                vehiculo_id ?? null,
                chofer_id ?? null,
                lote_codigo ?? null,
                lote_fecha_ingreso ?? null,
                lote_hora_ingreso ?? null,
                proveedor_id ?? null,
                lote_libras_remitidas ?? null,
                lote_peso_promedio ?? null,
                lote_n_piscina ?? null,
                lote_n_bines ?? null,
                lote_n_gavetas_conicas ?? null,
                lote_n_gavetas_caladas ?? null,
                lote_n_sacos_hielo ?? null,
                lote_n_sacos_metasulfito ?? null,
                lote_n_sacos_sal ?? null,
                lote_observaciones ?? null,
                usuario_id ?? null,
                id
            ]
        );

        if (result.affectedRows <= 0) return res.status(404).json({ message: "Lote no encontrado" });

        const [rows] = await conmysql.query('SELECT * FROM lote WHERE lote_id=?', [id]);
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
