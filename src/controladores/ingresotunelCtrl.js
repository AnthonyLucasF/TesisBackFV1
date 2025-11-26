/* // src/controladores/ingresotunelCtrl.js
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

// POST: Crear nuevo ingreso, validar campos, actualizar orden pendientes, emitir WS
export const postIngresoTunel = async (req, res) => {
    try {
        const body = req.body;

        // === LIMPIEZA DE NÚMEROS ===
        const cleanNumber = (val) => {
            if (val === null || val === undefined || val === '') return 0;
            const num = parseFloat(String(val).replace(/[^\d.,-]/g, '').replace(',', '.'));
            return isNaN(num) ? 0 : num;
        };

        // === BUSCAR ÚLTIMO CONTROL DE CALIDAD DEL LOTE ===
        let c_calidad_id = null;
        let defectos_id = null;

        if (body.lote_id) {
            const [calidad] = await conmysql.query(
                `SELECT c_calidad_id, defectos_id 
                 FROM control_calidad 
                 WHERE lote_id = ? 
                 ORDER BY c_calidad_id DESC 
                 LIMIT 1`,
                [body.lote_id]
            );
            if (calidad.length > 0) {
                c_calidad_id = calidad[0].c_calidad_id;
                defectos_id = calidad[0].defectos_id;
            }
        }

        // === DATOS FINALES CON DEFAULTS ===
        const data = {
            lote_id: body.lote_id,
            usuario_id: body.usuario_id || 1,
            proveedor_id: body.proveedor_id || 0,
            tipo_id: body.tipo_id,
            clase_id: body.clase_id || 0,
            color_id: body.color_id || 0,
            corte_id: body.corte_id || 0,
            talla_id: body.talla_id,
            peso_id: body.peso_id,
            glaseo_id: body.glaseo_id || 0,
            presentacion_id: body.presentacion_id || 0,
            orden_id: body.orden_id || 0,
            maquina_id: body.maquina_id || 0,
            grupo_id: body.grupo_id || 0,
            coche_id: body.coche_id,
            c_calidad_id,
            defectos_id,
            ingresotunel_fecha: body.ingresotunel_fecha || new Date().toISOString().slice(0, 19).replace('T', ' '),
            ingresotunel_peso_neto: cleanNumber(body.ingresotunel_peso_neto),
            ingresotunel_n_cajas: cleanNumber(body.ingresotunel_n_cajas),
            ingresotunel_libras_netas: cleanNumber(body.ingresotunel_libras_netas),
            ingresotunel_subtotales: cleanNumber(body.ingresotunel_subtotales),
            ingresotunel_total: cleanNumber(body.ingresotunel_total),
            ingresotunel_sobrante: cleanNumber(body.ingresotunel_sobrante),
            ingresotunel_basura: cleanNumber(body.ingresotunel_basura),
            ingresotunel_rendimiento: cleanNumber(body.ingresotunel_rendimiento),
            ingresotunel_observaciones: body.ingresotunel_observaciones || 'Todo Perfecto :D'
        };

        // === VALIDACIÓN OBLIGATORIA ===
        if (!data.lote_id || !data.tipo_id || !data.talla_id || !data.coche_id || data.ingresotunel_n_cajas <= 0) {
            return res.status(400).json({ message: "Faltan campos obligatorios" });
        }

        // === INSERT ===
        const [rows] = await conmysql.query(`
            INSERT INTO ingresotunel (
                lote_id, usuario_id, proveedor_id, tipo_id, clase_id, color_id, corte_id, talla_id,
                peso_id, glaseo_id, presentacion_id, orden_id, maquina_id, grupo_id, coche_id,
                c_calidad_id, defectos_id, ingresotunel_fecha, ingresotunel_peso_neto,
                ingresotunel_n_cajas, ingresotunel_libras_netas, ingresotunel_subtotales,
                ingresotunel_total, ingresotunel_sobrante, ingresotunel_basura,
                ingresotunel_rendimiento, ingresotunel_observaciones
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        `, [
            data.lote_id, data.usuario_id, data.proveedor_id, data.tipo_id, data.clase_id,
            data.color_id, data.corte_id, data.talla_id, data.peso_id, data.glaseo_id,
            data.presentacion_id, data.orden_id, data.maquina_id, data.grupo_id, data.coche_id,
            data.c_calidad_id, data.defectos_id, data.ingresotunel_fecha, data.ingresotunel_peso_neto,
            data.ingresotunel_n_cajas, data.ingresotunel_libras_netas, data.ingresotunel_subtotales,
            data.ingresotunel_total, data.ingresotunel_sobrante, data.ingresotunel_basura,
            data.ingresotunel_rendimiento, data.ingresotunel_observaciones
        ]);

        const nuevoId = rows.insertId;

        // === ACTUALIZAR ORDEN ===
        if (data.orden_id > 0 && data.ingresotunel_total > 0) {
            await conmysql.query(
                `UPDATE orden SET orden_libras_pendientes = GREATEST(0, orden_libras_pendientes - ?) 
                 WHERE orden_id = ?`,
                [data.ingresotunel_total, data.orden_id]
            );
            global._io?.emit("orden_actualizada", { orden_id: data.orden_id });
        }

        global._io?.emit("ingreso_tunel_nuevo", { ingresotunel_id: nuevoId });
        res.json({ id: nuevoId, message: "Ingreso registrado con éxito" });

    } catch (error) {
        console.error("ERROR POST INGRESO:", error);
        res.status(500).json({
            message: "Error al registrar ingreso",
            sqlError: error.message
        });
    }
};

// PUT: Update completo, recalcular pendientes orden, emitir WS
export const putIngresoTunel = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            lote_id, usuario_id, proveedor_id, tipo_id, clase_id, color_id, corte_id, talla_id, peso_id, glaseo_id, presentacion_id, orden_id, maquina_id, grupo_id, coche_id, c_calidad_id, defectos_id, ingresotunel_fecha, ingresotunel_peso_neto, ingresotunel_n_cajas, ingresotunel_libras_netas, ingresotunel_subtotales, ingresotunel_total, ingresotunel_sobrante, ingresotunel_basura, ingresotunel_rendimiento, ingresotunel_observaciones
        } = req.body;

        // Fetch anterior para ajustar pendientes
        const [anterior] = await conmysql.query('SELECT orden_id, ingresotunel_total FROM ingresotunel WHERE ingresotunel_id = ?', [id]);
        const anteriorOrden = anterior[0].orden_id;
        const anteriorTotal = anterior[0].ingresotunel_total;

        const [result] = await conmysql.query(
            'UPDATE ingresotunel SET lote_id=?, usuario_id=?, proveedor_id=?, tipo_id=?, clase_id=?, color_id=?, corte_id=?, talla_id=?, peso_id=?, glaseo_id=?, presentacion_id=?, orden_id=?, maquina_id=?, grupo_id=?, coche_id=?, c_calidad_id=?, defectos_id=?, ingresotunel_fecha=?, ingresotunel_peso_neto=?, ingresotunel_n_cajas=?, ingresotunel_libras_netas=?, ingresotunel_subtotales=?, ingresotunel_total=?, ingresotunel_sobrante=?, ingresotunel_basura=?, ingresotunel_rendimiento=?, ingresotunel_observaciones=? WHERE ingresotunel_id=?',
            [lote_id, usuario_id, proveedor_id, tipo_id, clase_id, color_id, corte_id, talla_id, peso_id, glaseo_id, presentacion_id, orden_id, maquina_id, grupo_id, coche_id, c_calidad_id, defectos_id, ingresotunel_fecha, ingresotunel_peso_neto, ingresotunel_n_cajas, ingresotunel_libras_netas, ingresotunel_subtotales, ingresotunel_total, ingresotunel_sobrante, ingresotunel_basura, ingresotunel_rendimiento, ingresotunel_observaciones, id]
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

// POST: Crear nuevo ingreso, validar campos, actualizar orden pendientes, emitir WS
export const postIngresoTunel = async (req, res) => {
    try {
        const body = req.body;

        // === LIMPIEZA DE NÚMEROS ===
        const cleanNumber = (val) => {
            if (val === null || val === undefined || val === '') return 0;
            const num = parseFloat(String(val).replace(/[^\d.,-]/g, '').replace(',', '.'));
            return isNaN(num) ? 0 : num;
        };

        // === BUSCAR ÚLTIMO CONTROL DE CALIDAD DEL LOTE ===
        let c_calidad_id = null;
        let defectos_id = null;

        if (body.lote_id) {
            const [calidad] = await conmysql.query(
                `SELECT c_calidad_id, defectos_id 
                 FROM control_calidad 
                 WHERE lote_id = ? 
                 ORDER BY c_calidad_id DESC 
                 LIMIT 1`,
                [body.lote_id]
            );
            if (calidad.length > 0) {
                c_calidad_id = calidad[0].c_calidad_id;
                defectos_id = calidad[0].defectos_id;
            }
        }

        // === DATOS FINALES CON DEFAULTS ===
        const data = {
            lote_id: body.lote_id,
            usuario_id: body.usuario_id || 1,
            proveedor_id: body.proveedor_id || 0,
            tipo_id: body.tipo_id,
            clase_id: body.clase_id || 0,
            color_id: body.color_id || 0,
            corte_id: body.corte_id || 0,
            talla_id: body.talla_id,
            peso_id: body.peso_id,
            glaseo_id: body.glaseo_id || 0,
            presentacion_id: body.presentacion_id || 0,
            orden_id: body.orden_id || 0,
            maquina_id: body.maquina_id || 0,
            grupo_id: body.grupo_id || 0,
            coche_id: body.coche_id,
            c_calidad_id,
            defectos_id,
            ingresotunel_fecha: body.ingresotunel_fecha || new Date().toISOString().slice(0, 19).replace('T', ' '),
            ingresotunel_peso_neto: cleanNumber(body.ingresotunel_peso_neto),
            ingresotunel_n_cajas: cleanNumber(body.ingresotunel_n_cajas),
            ingresotunel_libras_netas: cleanNumber(body.ingresotunel_libras_netas),
            ingresotunel_subtotales: cleanNumber(body.ingresotunel_subtotales),
            ingresotunel_total: cleanNumber(body.ingresotunel_total),
            ingresotunel_sobrante: cleanNumber(body.ingresotunel_sobrante),
            ingresotunel_basura: cleanNumber(body.ingresotunel_basura),
            ingresotunel_rendimiento: cleanNumber(body.ingresotunel_rendimiento),
            ingresotunel_observaciones: body.ingresotunel_observaciones || 'Todo Perfecto :D'
        };

        // === VALIDACIÓN OBLIGATORIA ===
        if (!data.lote_id || !data.tipo_id || !data.talla_id || !data.coche_id || data.ingresotunel_n_cajas <= 0) {
            return res.status(400).json({ message: "Faltan campos obligatorios" });
        }

        // === INSERT ===
        const [rows] = await conmysql.query(`
            INSERT INTO ingresotunel (
                lote_id, usuario_id, proveedor_id, tipo_id, clase_id, color_id, corte_id, talla_id,
                peso_id, glaseo_id, presentacion_id, orden_id, maquina_id, grupo_id, coche_id,
                c_calidad_id, defectos_id, ingresotunel_fecha, ingresotunel_peso_neto,
                ingresotunel_n_cajas, ingresotunel_libras_netas, ingresotunel_subtotales,
                ingresotunel_total, ingresotunel_sobrante, ingresotunel_basura,
                ingresotunel_rendimiento, ingresotunel_observaciones
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        `, [
            data.lote_id, data.usuario_id, data.proveedor_id, data.tipo_id, data.clase_id,
            data.color_id, data.corte_id, data.talla_id, data.peso_id, data.glaseo_id,
            data.presentacion_id, data.orden_id, data.maquina_id, data.grupo_id, data.coche_id,
            data.c_calidad_id, data.defectos_id, data.ingresotunel_fecha, data.ingresotunel_peso_neto,
            data.ingresotunel_n_cajas, data.ingresotunel_libras_netas, data.ingresotunel_subtotales,
            data.ingresotunel_total, data.ingresotunel_sobrante, data.ingresotunel_basura,
            data.ingresotunel_rendimiento, data.ingresotunel_observaciones
        ]);

        const nuevoId = rows.insertId;

        // === ACTUALIZAR ORDEN ===
        if (data.orden_id > 0 && data.ingresotunel_total > 0) {
            await conmysql.query(
                `UPDATE orden SET orden_libras_pendientes = GREATEST(0, orden_libras_pendientes - ?) 
                 WHERE orden_id = ?`,
                [data.ingresotunel_total, data.orden_id]
            );
            global._io?.emit("orden_actualizada", { orden_id: data.orden_id });
        }

        global._io?.emit("ingreso_tunel_nuevo", { ingresotunel_id: nuevoId });
        res.json({ id: nuevoId, message: "Ingreso registrado con éxito" });

    } catch (error) {
        console.error("ERROR POST INGRESO:", error);
        res.status(500).json({
            message: "Error al registrar ingreso",
            sqlError: error.message
        });
    }
};

// PUT: Update completo, recalcular pendientes orden, emitir WS
export const putIngresoTunel = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            lote_id, usuario_id, proveedor_id, tipo_id, clase_id, color_id, corte_id, talla_id, peso_id, glaseo_id, presentacion_id, orden_id, maquina_id, grupo_id, coche_id, c_calidad_id, defectos_id, ingresotunel_fecha, ingresotunel_peso_neto, ingresotunel_n_cajas, ingresotunel_libras_netas, ingresotunel_subtotales, ingresotunel_total, ingresotunel_sobrante, ingresotunel_basura, ingresotunel_rendimiento, ingresotunel_observaciones
        } = req.body;

        // Fetch anterior para ajustar pendientes
        const [anterior] = await conmysql.query('SELECT orden_id, ingresotunel_total FROM ingresotunel WHERE ingresotunel_id = ?', [id]);
        const anteriorOrden = anterior[0].orden_id;
        const anteriorTotal = anterior[0].ingresotunel_total;

        const [result] = await conmysql.query(
            'UPDATE ingresotunel SET lote_id=?, usuario_id=?, proveedor_id=?, tipo_id=?, clase_id=?, color_id=?, corte_id=?, talla_id=?, peso_id=?, glaseo_id=?, presentacion_id=?, orden_id=?, maquina_id=?, grupo_id=?, coche_id=?, c_calidad_id=?, defectos_id=?, ingresotunel_fecha=?, ingresotunel_peso_neto=?, ingresotunel_n_cajas=?, ingresotunel_libras_netas=?, ingresotunel_subtotales=?, ingresotunel_total=?, ingresotunel_sobrante=?, ingresotunel_basura=?, ingresotunel_rendimiento=?, ingresotunel_observaciones=? WHERE ingresotunel_id=?',
            [lote_id, usuario_id, proveedor_id, tipo_id, clase_id, color_id, corte_id, talla_id, peso_id, glaseo_id, presentacion_id, orden_id, maquina_id, grupo_id, coche_id, c_calidad_id, defectos_id, ingresotunel_fecha, ingresotunel_peso_neto, ingresotunel_n_cajas, ingresotunel_libras_netas, ingresotunel_subtotales, ingresotunel_total, ingresotunel_sobrante, ingresotunel_basura, ingresotunel_rendimiento, ingresotunel_observaciones, id]
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