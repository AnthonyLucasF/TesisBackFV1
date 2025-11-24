// src/controladores/ingresotunelCtrl.js
import { conmysql } from "../db.js";

// SELECT: Obtener todos los registros ordenados descendente por fecha
export const getIngresoTunel = async (req, res) => {
    try {
        const [result] = await conmysql.query('SELECT * FROM ingresotunel ORDER BY ingresotunel_fecha DESC');
        res.json(result);
    } catch (error) {
        return res.status(500).json({ message: "Error al consultar Ingresos de Túnel" });
    }
};

// SELECT por lote_id (para resumen entero/cola)
export const getIngresoTunelPorLote = async (req, res) => {
    try {
        const { lote_id } = req.params;
        const [result] = await conmysql.query('SELECT * FROM ingresotunel WHERE lote_id = ? ORDER BY ingresotunel_fecha DESC', [lote_id]);
        res.json(result);
    } catch (error) {
        return res.status(500).json({ message: "Error al consultar Ingresos por Lote" });
    }
};

// GET por ID with JOINs for descripciones (tipo, talla, peso, etc.)
export const getIngresoTunelxid = async (req, res) => {
    try {
        const [result] = await conmysql.query(`
      SELECT i.*, 
        l.lote_codigo as lote_codigo,
        t.tipo_descripcion as tipo_descripcion,
        ta.talla_descripcion as talla_descripcion,
        p.peso_descripcion as peso_descripcion,
        (i.ingresotunel_total - i.ingresotunel_sobrante - i.ingresotunel_basura) / l.lote_peso_promedio * 100 as rendimiento_calculado
      FROM ingresotunel i
      LEFT JOIN lote l ON i.lote_id = l.lote_id
      LEFT JOIN tipo t ON i.tipo_id = t.tipo_id
      LEFT JOIN talla ta ON i.talla_id = ta.talla_id
      LEFT JOIN peso p ON i.peso_id = p.peso_id
      WHERE i.ingresotunel_id = ?
    `, [req.params.id]);
        if (result.length <= 0) return res.status(404).json({ ingresotunel_id: 0, message: "Ingreso no encontrado" });
        res.json(result[0]);
    } catch (error) {
        return res.status(500).json({ message: "Error del Servidor" });
    }
};

// GET rendimiento por lote_id (total_procesado, rendimiento)
/* export const getRendimientoLote = async (req, res) => {
    try {
        const { lote_id } = req.params;
        const [result] = await conmysql.query(`
            SELECT 
                SUM(ingresotunel_total) as total_procesado,
                (SUM(ingresotunel_total) / l.lote_peso_promedio * 100) as rendimiento
            FROM ingresotunel i
            LEFT JOIN lote l ON i.lote_id = l.lote_id
            WHERE i.lote_id = ?
            GROUP BY i.lote_id
        `, [lote_id]);
        if (result.length <= 0 || !result[0].total_procesado) {
            return res.json({ total_procesado: 0, rendimiento: 0 });
        }
        res.json(result[0]);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
}; */

export const getRendimientoLote = async (req, res) => {
    try {
        const { lote_id } = req.params;
        const [result] = await conmysql.query(`
      SELECT 
        SUM(ingresotunel_total) as total_procesado,
        IF(l.lote_peso_promedio > 0, (SUM(ingresotunel_total) / l.lote_peso_promedio * 100), 0) as rendimiento
      FROM ingresotunel i
      LEFT JOIN lote l ON i.lote_id = l.lote_id
      WHERE i.lote_id = ?
      GROUP BY i.lote_id
    `, [lote_id]);
        if (result.length <= 0 || !result[0].total_procesado) {
            return res.json({ total_procesado: 0, rendimiento: 0 });
        }
        res.json(result[0]);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

// Breve explicación: Agregado IF para manejar lote_peso_promedio =0, evita NaN/rendimiento erróneo (e.g., 1.829827%).

// POST: Crear nuevo ingreso, validar campos, actualizar orden pendientes, emitir WS
export const postIngresoTunel = async (req, res) => {
    try {
        const {
            lote_id, orden_id, tipo_id, talla_id, peso_id,
            ingresotunel_n_cajas, ingresotunel_libras_netas, ingresotunel_total,
            ingresotunel_sobrante, ingresotunel_basura, ingresotunel_rendimiento
        } = req.body;

        // Validaciones básicas
        if (!lote_id || !tipo_id || !talla_id || !ingresotunel_n_cajas) {
            return res.status(400).json({ message: "Campos obligatorios faltantes: lote, tipo, talla, n_cajas" });
        }
        if (ingresotunel_n_cajas > 330) { // Max coche futuro; por ahora soft check
            return res.status(400).json({ message: "Número de cajas excede máximo por coche (330)" });
        }

        const [rows] = await conmysql.query(
            'INSERT INTO ingresotunel (lote_id, orden_id, tipo_id, talla_id, peso_id, ingresotunel_n_cajas, ingresotunel_libras_netas, ingresotunel_total, ingresotunel_sobrante, ingresotunel_basura, ingresotunel_rendimiento) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [lote_id, orden_id, tipo_id, talla_id, peso_id, ingresotunel_n_cajas, ingresotunel_libras_netas, ingresotunel_total, ingresotunel_sobrante, ingresotunel_basura, ingresotunel_rendimiento]
        );

        const nuevoId = rows.insertId;

        // Actualizar orden pendientes si orden_id >0
        if (orden_id > 0) {
            await conmysql.query(
                'UPDATE orden SET orden_libras_pendientes = orden_libras_pendientes - ? WHERE orden_id = ?',
                [ingresotunel_total, orden_id]
            );
            // Check si cumplida
            const [orden] = await conmysql.query('SELECT orden_libras_pendientes FROM orden WHERE orden_id = ?', [orden_id]);
            if (orden[0].orden_libras_pendientes <= 0) {
                await conmysql.query('UPDATE orden SET orden_estado = "cumplida" WHERE orden_id = ?', [orden_id]);
                global._io.emit("orden_cumplida", { orden_id });
            }
            global._io.emit("orden_actualizada", { orden_id });
        }

        // Emitir WS nuevo ingreso
        global._io.emit("ingreso_tunel_nuevo", { ingresotunel_id: nuevoId });

        res.json({ id: nuevoId, message: "Ingreso registrado con éxito" });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

// PUT: Update completo, recalcular pendientes orden, emitir WS
export const putIngresoTunel = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            lote_id, orden_id, tipo_id, talla_id, peso_id,
            ingresotunel_n_cajas, ingresotunel_libras_netas, ingresotunel_total,
            ingresotunel_sobrante, ingresotunel_basura, ingresotunel_rendimiento
        } = req.body;

        // Fetch anterior para ajustar pendientes
        const [anterior] = await conmysql.query('SELECT orden_id, ingresotunel_total FROM ingresotunel WHERE ingresotunel_id = ?', [id]);
        const anteriorOrden = anterior[0].orden_id;
        const anteriorTotal = anterior[0].ingresotunel_total;

        const [result] = await conmysql.query(
            'UPDATE ingresotunel SET lote_id=?, orden_id=?, tipo_id=?, talla_id=?, peso_id=?, ingresotunel_n_cajas=?, ingresotunel_libras_netas=?, ingresotunel_total=?, ingresotunel_sobrante=?, ingresotunel_basura=?, ingresotunel_rendimiento=? WHERE ingresotunel_id=?',
            [lote_id, orden_id, tipo_id, talla_id, peso_id, ingresotunel_n_cajas, ingresotunel_libras_netas, ingresotunel_total, ingresotunel_sobrante, ingresotunel_basura, ingresotunel_rendimiento, id]
        );

        if (result.affectedRows <= 0) return res.status(404).json({ message: "Ingreso no encontrado" });

        // Ajustar pendientes orden
        if (anteriorOrden > 0) {
            await conmysql.query('UPDATE orden SET orden_libras_pendientes = orden_libras_pendientes + ? WHERE orden_id = ?', [anteriorTotal, anteriorOrden]);
        }
        if (orden_id > 0) {
            await conmysql.query('UPDATE orden SET orden_libras_pendientes = orden_libras_pendientes - ? WHERE orden_id = ?', [ingresotunel_total, orden_id]);
            // Check cumplida
            const [orden] = await conmysql.query('SELECT orden_libras_pendientes FROM orden WHERE orden_id = ?', [orden_id]);
            if (orden[0].orden_libras_pendientes <= 0) {
                await conmysql.query('UPDATE orden SET orden_estado = "cumplida" WHERE orden_id = ?', [orden_id]);
                global._io.emit("orden_cumplida", { orden_id });
            }
            global._io.emit("orden_actualizada", { orden_id });
        }

        // Emitir WS update
        global._io.emit("ingreso_tunel_actualizado", { ingresotunel_id: id });

        const [rows] = await conmysql.query('SELECT * FROM ingresotunel WHERE ingresotunel_id=?', [id]);
        res.json(rows[0]);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

// DELETE: Eliminar, ajustar pendientes orden, emitir WS
export const deleteIngresoTunel = async (req, res) => {
    try {
        const { id } = req.params;

        // Fetch para ajustar pendientes
        const [ingreso] = await conmysql.query('SELECT orden_id, ingresotunel_total FROM ingresotunel WHERE ingresotunel_id = ?', [id]);
        const ordenId = ingreso[0].orden_id;
        const total = ingreso[0].ingresotunel_total;

        await conmysql.query('DELETE FROM ingresotunel WHERE ingresotunel_id = ?', [id]);

        if (ordenId > 0) {
            await conmysql.query('UPDATE orden SET orden_libras_pendientes = orden_libras_pendientes + ? WHERE orden_id = ?', [total, ordenId]);
            global._io.emit("orden_actualizada", { orden_id: ordenId });
        }

        // Emitir WS delete
        global._io.emit("ingreso_tunel_eliminado", { ingresotunel_id: id });

        res.status(202).json({ message: "Ingreso eliminado con éxito" });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

/* 
  // src/controladores/ingresotunelCtrl.js
import { conmysql } from "../db.js";

// SELECT: Obtener todos los registros ordenados descendente por fecha
export const getIngresoTunel = async (req, res) => {
    try {
        const [result] = await conmysql.query('SELECT * FROM ingresotunel ORDER BY ingresotunel_fecha DESC');
        res.json(result);
    } catch (error) {
        return res.status(500).json({ message: "Error al consultar Ingresos de Túnel" });
    }
};

// SELECT por lote_id (para resumen entero/cola)
export const getIngresoTunelPorLote = async (req, res) => {
    try {
        const { lote_id } = req.params;
        const [result] = await conmysql.query('SELECT * FROM ingresotunel WHERE lote_id = ? ORDER BY ingresotunel_fecha DESC', [lote_id]);
        res.json(result);
    } catch (error) {
        return res.status(500).json({ message: "Error al consultar Ingresos por Lote" });
    }
};

// GET por ID with JOINs for descripciones (tipo, talla, peso, etc.)
export const getIngresoTunelxid = async (req, res) => {
    try {
        const [result] = await conmysql.query(`
      SELECT i.*, 
        l.lote_codigo as lote_codigo,
        t.tipo_descripcion as tipo_descripcion,
        ta.talla_descripcion as talla_descripcion,
        p.peso_descripcion as peso_descripcion,
        (i.ingresotunel_total - i.ingresotunel_sobrante - i.ingresotunel_basura) / l.lote_peso_promedio * 100 as rendimiento_calculado
      FROM ingresotunel i
      LEFT JOIN lote l ON i.lote_id = l.lote_id
      LEFT JOIN tipo t ON i.tipo_id = t.tipo_id
      LEFT JOIN talla ta ON i.talla_id = ta.talla_id
      LEFT JOIN peso p ON i.peso_id = p.peso_id
      WHERE i.ingresotunel_id = ?
    `, [req.params.id]);
        if (result.length <= 0) return res.status(404).json({ ingresotunel_id: 0, message: "Ingreso no encontrado" });
        res.json(result[0]);
    } catch (error) {
        return res.status(500).json({ message: "Error del Servidor" });
    }
};

// POST: Crear nuevo ingreso, validar campos, actualizar orden pendientes, emitir WS
export const postIngresoTunel = async (req, res) => {
    try {
        const {
            lote_id, orden_id, tipo_id, talla_id, peso_id,
            ingresotunel_n_cajas, ingresotunel_libras_netas, ingresotunel_total,
            ingresotunel_sobrante, ingresotunel_basura, ingresotunel_rendimiento
        } = req.body;

        // Validaciones básicas
        if (!lote_id || !tipo_id || !talla_id || !ingresotunel_n_cajas) {
            return res.status(400).json({ message: "Campos obligatorios faltantes: lote, tipo, talla, n_cajas" });
        }
        if (ingresotunel_n_cajas > 330) { // Max coche futuro; por ahora soft check
            return res.status(400).json({ message: "Número de cajas excede máximo por coche (330)" });
        }

        const [rows] = await conmysql.query(
            'INSERT INTO ingresotunel (lote_id, orden_id, tipo_id, talla_id, peso_id, ingresotunel_n_cajas, ingresotunel_libras_netas, ingresotunel_total, ingresotunel_sobrante, ingresotunel_basura, ingresotunel_rendimiento) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [lote_id, orden_id, tipo_id, talla_id, peso_id, ingresotunel_n_cajas, ingresotunel_libras_netas, ingresotunel_total, ingresotunel_sobrante, ingresotunel_basura, ingresotunel_rendimiento]
        );

        const nuevoId = rows.insertId;

        // Actualizar orden pendientes si orden_id >0
        if (orden_id > 0) {
            await conmysql.query(
                'UPDATE orden SET orden_libras_pendientes = orden_libras_pendientes - ? WHERE orden_id = ?',
                [ingresotunel_total, orden_id]
            );
            // Check si cumplida
            const [orden] = await conmysql.query('SELECT orden_libras_pendientes FROM orden WHERE orden_id = ?', [orden_id]);
            if (orden[0].orden_libras_pendientes <= 0) {
                await conmysql.query('UPDATE orden SET orden_estado = "cumplida" WHERE orden_id = ?', [orden_id]);
                global._io.emit("orden_cumplida", { orden_id });
            }
            global._io.emit("orden_actualizada", { orden_id });
        }

        // Emitir WS nuevo ingreso
        global._io.emit("ingreso_tunel_nuevo", { ingresotunel_id: nuevoId });

        res.json({ id: nuevoId, message: "Ingreso registrado con éxito" });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

// PUT: Update completo, recalcular pendientes orden, emitir WS
export const putIngresoTunel = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            lote_id, orden_id, tipo_id, talla_id, peso_id,
            ingresotunel_n_cajas, ingresotunel_libras_netas, ingresotunel_total,
            ingresotunel_sobrante, ingresotunel_basura, ingresotunel_rendimiento
        } = req.body;

        // Fetch anterior para ajustar pendientes
        const [anterior] = await conmysql.query('SELECT orden_id, ingresotunel_total FROM ingresotunel WHERE ingresotunel_id = ?', [id]);
        const anteriorOrden = anterior[0].orden_id;
        const anteriorTotal = anterior[0].ingresotunel_total;

        const [result] = await conmysql.query(
            'UPDATE ingresotunel SET lote_id=?, orden_id=?, tipo_id=?, talla_id=?, peso_id=?, ingresotunel_n_cajas=?, ingresotunel_libras_netas=?, ingresotunel_total=?, ingresotunel_sobrante=?, ingresotunel_basura=?, ingresotunel_rendimiento=? WHERE ingresotunel_id=?',
            [lote_id, orden_id, tipo_id, talla_id, peso_id, ingresotunel_n_cajas, ingresotunel_libras_netas, ingresotunel_total, ingresotunel_sobrante, ingresotunel_basura, ingresotunel_rendimiento, id]
        );

        if (result.affectedRows <= 0) return res.status(404).json({ message: "Ingreso no encontrado" });

        // Ajustar pendientes orden
        if (anteriorOrden > 0) {
            await conmysql.query('UPDATE orden SET orden_libras_pendientes = orden_libras_pendientes + ? WHERE orden_id = ?', [anteriorTotal, anteriorOrden]);
        }
        if (orden_id > 0) {
            await conmysql.query('UPDATE orden SET orden_libras_pendientes = orden_libras_pendientes - ? WHERE orden_id = ?', [ingresotunel_total, orden_id]);
            // Check cumplida
            const [orden] = await conmysql.query('SELECT orden_libras_pendientes FROM orden WHERE orden_id = ?', [orden_id]);
            if (orden[0].orden_libras_pendientes <= 0) {
                await conmysql.query('UPDATE orden SET orden_estado = "cumplida" WHERE orden_id = ?', [orden_id]);
                global._io.emit("orden_cumplida", { orden_id });
            }
            global._io.emit("orden_actualizada", { orden_id });
        }

        // Emitir WS update
        global._io.emit("ingreso_tunel_actualizado", { ingresotunel_id: id });

        const [rows] = await conmysql.query('SELECT * FROM ingresotunel WHERE ingresotunel_id=?', [id]);
        res.json(rows[0]);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

// DELETE: Eliminar, ajustar pendientes orden, emitir WS
export const deleteIngresoTunel = async (req, res) => {
    try {
        const { id } = req.params;

        // Fetch para ajustar pendientes
        const [ingreso] = await conmysql.query('SELECT orden_id, ingresotunel_total FROM ingresotunel WHERE ingresotunel_id = ?', [id]);
        const ordenId = ingreso[0].orden_id;
        const total = ingreso[0].ingresotunel_total;

        await conmysql.query('DELETE FROM ingresotunel WHERE ingresotunel_id = ?', [id]);

        if (ordenId > 0) {
            await conmysql.query('UPDATE orden SET orden_libras_pendientes = orden_libras_pendientes + ? WHERE orden_id = ?', [total, ordenId]);
            global._io.emit("orden_actualizada", { orden_id: ordenId });
        }

        // Emitir WS delete
        global._io.emit("ingreso_tunel_eliminado", { ingresotunel_id: id });

        res.status(202).json({ message: "Ingreso eliminado con éxito" });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
}; */