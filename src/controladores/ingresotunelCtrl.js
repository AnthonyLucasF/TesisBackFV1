/* // src/controladores/ingresotunelCtrl.js
import { conmysql } from "../db.js";

// GET: Obtener todos los ingresos de túnel con JOINs completos, ordenados por fecha descendente
export const getIngresoTunel = async (req, res) => {
  try {
    const [result] = await conmysql.query(`
      SELECT i.*, 
        l.lote_codigo, l.lote_libras_remitidas, l.lote_peso_promedio, l.clase_id as lote_clase_id, l.color_id as lote_color_id,
        t.tipo_descripcion as lote_tipo,
        u.usuario_nombre, 
        pr.proveedor_nombre, 
        ty.tipo_descripcion,
        cl.clase_descripcion, 
        co.color_descripcion, 
        cr.corte_descripcion, 
        ta.talla_descripcion, 
        pe.peso_descripcion,
        g.glaseo_cantidad, 
        p.presentacion_descripcion, 
        o.orden_codigo, o.orden_estado, o.orden_total_master,
        m.maquina_descripcion, 
        gr.grupo_nombre,
        ch.coche_descripcion, ch.coche_estado,
        cal.c_calidad_peso_bruto, cal.c_calidad_peso_neto, cal.c_calidad_uniformidad,
        cal.c_calidad_olor, cal.c_calidad_sabor, cal.c_calidad_observaciones,
        def.defectos_total_defectos, def.defectos_observaciones, def.defectos_acciones_correctivas
      FROM ingresotunel i
      LEFT JOIN lote l ON i.lote_id = l.lote_id
      LEFT JOIN tipo t ON l.tipo_id = t.tipo_id
      LEFT JOIN usuario u ON i.usuario_id = u.usuario_id
      LEFT JOIN proveedor pr ON i.proveedor_id = pr.proveedor_id
      LEFT JOIN tipo ty ON i.tipo_id = ty.tipo_id
      LEFT JOIN clase cl ON i.clase_id = cl.clase_id
      LEFT JOIN color co ON i.color_id = co.color_id
      LEFT JOIN corte cr ON i.corte_id = cr.corte_id
      LEFT JOIN talla ta ON i.talla_id = ta.talla_id
      LEFT JOIN peso pe ON i.peso_id = pe.peso_id
      LEFT JOIN glaseo g ON i.glaseo_id = g.glaseo_id
      LEFT JOIN presentacion p ON i.presentacion_id = p.presentacion_id
      LEFT JOIN orden o ON i.orden_id = o.orden_id
      LEFT JOIN maquina m ON i.maquina_id = m.maquina_id
      LEFT JOIN grupo gr ON i.grupo_id = gr.grupo_id
      LEFT JOIN coche ch ON i.coche_id = ch.coche_id
      LEFT JOIN control_calidad cal ON i.c_calidad_id = cal.c_calidad_id
      LEFT JOIN defectos def ON i.defectos_id = def.defectos_id
      ORDER BY i.ingresotunel_fecha DESC
    `);
    res.json(result);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// GET por ID con JOINs completos
export const getIngresoTunelxid = async (req, res) => {
  try {
    const [result] = await conmysql.query(`
      SELECT i.*, 
        l.lote_codigo, l.lote_libras_remitidas, l.lote_peso_promedio, l.clase_id as lote_clase_id, l.color_id as lote_color_id,
        t.tipo_descripcion as lote_tipo,
        u.usuario_nombre, 
        pr.proveedor_nombre, 
        ty.tipo_descripcion,
        cl.clase_descripcion, 
        co.color_descripcion, 
        cr.corte_descripcion, 
        ta.talla_descripcion, 
        pe.peso_descripcion,
        g.glaseo_cantidad, 
        p.presentacion_descripcion, 
        o.orden_codigo, o.orden_estado, o.orden_total_master,
        m.maquina_descripcion, 
        gr.grupo_nombre,
        ch.coche_descripcion, ch.coche_estado,
        cal.c_calidad_peso_bruto, cal.c_calidad_peso_neto, cal.c_calidad_uniformidad,
        cal.c_calidad_olor, cal.c_calidad_sabor, cal.c_calidad_observaciones,
        def.defectos_total_defectos, def.defectos_observaciones, def.defectos_acciones_correctivas
      FROM ingresotunel i
      LEFT JOIN lote l ON i.lote_id = l.lote_id
      LEFT JOIN tipo t ON l.tipo_id = t.tipo_id
      LEFT JOIN usuario u ON i.usuario_id = u.usuario_id
      LEFT JOIN proveedor pr ON i.proveedor_id = pr.proveedor_id
      LEFT JOIN tipo ty ON i.tipo_id = ty.tipo_id
      LEFT JOIN clase cl ON i.clase_id = cl.clase_id
      LEFT JOIN color co ON i.color_id = co.color_id
      LEFT JOIN corte cr ON i.corte_id = cr.corte_id
      LEFT JOIN talla ta ON i.talla_id = ta.talla_id
      LEFT JOIN peso pe ON i.peso_id = pe.peso_id
      LEFT JOIN glaseo g ON i.glaseo_id = g.glaseo_id
      LEFT JOIN presentacion p ON i.presentacion_id = p.presentacion_id
      LEFT JOIN orden o ON i.orden_id = o.orden_id
      LEFT JOIN maquina m ON i.maquina_id = m.maquina_id
      LEFT JOIN grupo gr ON i.grupo_id = gr.grupo_id
      LEFT JOIN coche ch ON i.coche_id = ch.coche_id
      LEFT JOIN control_calidad cal ON i.c_calidad_id = cal.c_calidad_id
      LEFT JOIN defectos def ON i.defectos_id = def.defectos_id
      WHERE i.ingresotunel_id = ?
    `, [req.params.id]);
    if (result.length <= 0) return res.status(404).json({ ingresotunel_id: 0, message: "Ingreso de Túnel no encontrado" });
    res.json(result[0]);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// POST: Registrar nuevo ingreso de túnel, actualizar orden, calcular rendimiento, actualizar estado de coche, emitir WS
export const postIngresoTunel = async (req, res) => {
  try {
    const {
      lote_id, usuario_id, proveedor_id, tipo_id, clase_id, color_id, corte_id, talla_id, peso_id,
      glaseo_id, presentacion_id, orden_id, maquina_id, grupo_id, coche_id, c_calidad_id, defectos_id,
      ingresotunel_peso_neto, ingresotunel_n_cajas, ingresotunel_libras_netas, ingresotunel_subtotales,
      ingresotunel_total, ingresotunel_sobrante, ingresotunel_basura, ingresotunel_observaciones
    } = req.body;

    if (!lote_id || !orden_id || !coche_id) return res.status(400).json({ message: "lote_id, orden_id y coche_id son requeridos" });

    // Obtener datos del lote para cálculo de rendimiento
    const [lote] = await conmysql.query('SELECT lote_peso_promedio, tipo_id, parent_lote_id FROM lote WHERE lote_id = ?', [lote_id]);
    if (lote.length === 0) return res.status(404).json({ message: "Lote no encontrado" });
    const promedio = lote[0].lote_peso_promedio || 0;
    const loteTipoId = lote[0].tipo_id;
    const parentId = lote[0].parent_lote_id || 0;

    // Determinar si es entero o cola basado en tipo_id (asumiendo tipo_id 1 = entero, 2 = cola; ajustar según BD)
    const [tipo] = await conmysql.query('SELECT tipo_descripcion FROM tipo WHERE tipo_id = ?', [loteTipoId]);
    const loteTipo = tipo[0].tipo_descripcion.toLowerCase();

    // Calcular basura_parent
    let basura_parent = 0;
    if (loteTipo.includes('cola') && parentId) {
      // Basura de descabezado (cabezas)
      const [descabezadoBasura] = await conmysql.query('SELECT SUM(descabezado_basura) as basura FROM descabezado WHERE lote_id = ?', [parentId]);
      basura_parent += descabezadoBasura[0].basura || 0;

      // Basura de pelado si aplica
      const [peladoBasura] = await conmysql.query('SELECT SUM(pelado_basura) as basura FROM pelado WHERE lote_id = ?', [parentId]);
      basura_parent += peladoBasura[0].basura || 0;
    }

    // Calcular basura total (ingresotunel_basura + basura_parent)
    const total_basura = (ingresotunel_basura || 0) + basura_parent;

    // Calcular rendimiento
    let ingresotunel_rendimiento = 0;
    const empacado = ingresotunel_total || 0;
    if (loteTipo.includes('entero')) {
      ingresotunel_rendimiento = promedio > 0 ? ((empacado - (ingresotunel_sobrante || 0)) / promedio * 100).toFixed(2) : 0;
    } else {
      ingresotunel_rendimiento = promedio > 0 ? (empacado / (promedio - total_basura) * 100).toFixed(2) : 0;
    }

    // Fecha actual
    const ingresotunel_fecha = new Date().toISOString().slice(0, 19).replace('T', ' ');

    // Insertar el nuevo ingreso
    const [insertResult] = await conmysql.query(
      `INSERT INTO ingresotunel (
        lote_id, usuario_id, proveedor_id, tipo_id, clase_id, color_id, corte_id, talla_id, peso_id,
        glaseo_id, presentacion_id, orden_id, maquina_id, grupo_id, coche_id, c_calidad_id, defectos_id,
        ingresotunel_fecha, ingresotunel_peso_neto, ingresotunel_n_cajas, ingresotunel_libras_netas,
        ingresotunel_subtotales, ingresotunel_total, ingresotunel_sobrante, ingresotunel_basura,
        ingresotunel_rendimiento, ingresotunel_observaciones
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        lote_id, usuario_id, proveedor_id, tipo_id, clase_id, color_id, corte_id, talla_id, peso_id,
        glaseo_id, presentacion_id, orden_id, maquina_id, grupo_id, coche_id, c_calidad_id, defectos_id,
        ingresotunel_fecha, ingresotunel_peso_neto, ingresotunel_n_cajas, ingresotunel_libras_netas,
        ingresotunel_subtotales, ingresotunel_total, ingresotunel_sobrante, ingresotunel_basura,
        ingresotunel_rendimiento, ingresotunel_observaciones
      ]
    );

    const nuevoId = insertResult.insertId;

    // Actualizar libras pendientes en orden
    await updateOrdenPendientes(orden_id, -ingresotunel_total);

    // Actualizar estado del coche a 'En túnel'
    await conmysql.query('UPDATE coche SET coche_estado = "En túnel" WHERE coche_id = ?', [coche_id]);

    // Programar cambio de estado a 'Disponible' después de 2 horas (7200000 ms)
    setTimeout(async () => {
      try {
        await conmysql.query('UPDATE coche SET coche_estado = "Disponible" WHERE coche_id = ?', [coche_id]);
        global._io.emit('coche_disponible', { coche_id });
      } catch (error) {
        console.error('Error al actualizar estado de coche:', error);
      }
    }, 7200000); // 2 horas

    // Obtener el nuevo registro completo
    const [nuevoRegistro] = await conmysql.query(`
      SELECT i.*, 
        l.lote_codigo, l.lote_libras_remitidas, l.lote_peso_promedio, l.clase_id as lote_clase_id, l.color_id as lote_color_id,
        t.tipo_descripcion as lote_tipo,
        u.usuario_nombre, 
        pr.proveedor_nombre, 
        ty.tipo_descripcion,
        cl.clase_descripcion, 
        co.color_descripcion, 
        cr.corte_descripcion, 
        ta.talla_descripcion, 
        pe.peso_descripcion,
        g.glaseo_cantidad, 
        p.presentacion_descripcion, 
        o.orden_codigo, o.orden_estado, o.orden_total_master,
        m.maquina_descripcion, 
        gr.grupo_nombre,
        ch.coche_descripcion, ch.coche_estado,
        cal.c_calidad_peso_bruto, cal.c_calidad_peso_neto, cal.c_calidad_uniformidad,
        cal.c_calidad_olor, cal.c_calidad_sabor, cal.c_calidad_observaciones,
        def.defectos_total_defectos, def.defectos_observaciones, def.defectos_acciones_correctivas
      FROM ingresotunel i
      LEFT JOIN lote l ON i.lote_id = l.lote_id
      LEFT JOIN tipo t ON l.tipo_id = t.tipo_id
      LEFT JOIN usuario u ON i.usuario_id = u.usuario_id
      LEFT JOIN proveedor pr ON i.proveedor_id = pr.proveedor_id
      LEFT JOIN tipo ty ON i.tipo_id = ty.tipo_id
      LEFT JOIN clase cl ON i.clase_id = cl.clase_id
      LEFT JOIN color co ON i.color_id = co.color_id
      LEFT JOIN corte cr ON i.corte_id = cr.corte_id
      LEFT JOIN talla ta ON i.talla_id = ta.talla_id
      LEFT JOIN peso pe ON i.peso_id = pe.peso_id
      LEFT JOIN glaseo g ON i.glaseo_id = g.glaseo_id
      LEFT JOIN presentacion p ON i.presentacion_id = p.presentacion_id
      LEFT JOIN orden o ON i.orden_id = o.orden_id
      LEFT JOIN maquina m ON i.maquina_id = m.maquina_id
      LEFT JOIN grupo gr ON i.grupo_id = gr.grupo_id
      LEFT JOIN coche ch ON i.coche_id = ch.coche_id
      LEFT JOIN control_calidad cal ON i.c_calidad_id = cal.c_calidad_id
      LEFT JOIN defectos def ON i.defectos_id = def.defectos_id
      WHERE i.ingresotunel_id = ?
    `, [nuevoId]);

    // Emitir WebSocket
    global._io.emit("ingreso_tunel_nuevo", nuevoRegistro[0]);

    res.json(nuevoRegistro[0]);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// PUT: Actualizar ingreso completo, recalcular rendimiento, ajustar pendientes, emitir WS
export const putIngresoTunel = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      lote_id, usuario_id, proveedor_id, tipo_id, clase_id, color_id, corte_id, talla_id, peso_id,
      glaseo_id, presentacion_id, orden_id, maquina_id, grupo_id, coche_id, c_calidad_id, defectos_id,
      ingresotunel_peso_neto, ingresotunel_n_cajas, ingresotunel_libras_netas, ingresotunel_subtotales,
      ingresotunel_total, ingresotunel_sobrante, ingresotunel_basura, ingresotunel_observaciones
    } = req.body;

    // Obtener datos actuales para ajustar pendientes
    const [actual] = await conmysql.query('SELECT orden_id, ingresotunel_total FROM ingresotunel WHERE ingresotunel_id = ?', [id]);
    if (actual.length === 0) return res.status(404).json({ message: "Ingreso de Túnel no encontrado" });
    const viejoOrdenId = actual[0].orden_id;
    const viejoTotal = actual[0].ingresotunel_total || 0;

    // Revertir viejo total en orden anterior si cambia
    if (viejoOrdenId && viejoOrdenId !== orden_id) {
      await updateOrdenPendientes(viejoOrdenId, viejoTotal); // Sumar de vuelta
    }

    // Obtener datos del lote para recalc
    const [lote] = await conmysql.query('SELECT lote_peso_promedio, tipo_id, parent_lote_id FROM lote WHERE lote_id = ?', [lote_id]);
    const promedio = lote[0].lote_peso_promedio || 0;
    const loteTipoId = lote[0].tipo_id;
    const parentId = lote[0].parent_lote_id || 0;

    const [tipo] = await conmysql.query('SELECT tipo_descripcion FROM tipo WHERE tipo_id = ?', [loteTipoId]);
    const loteTipo = tipo[0].tipo_descripcion.toLowerCase();

    let basura_parent = 0;
    if (loteTipo.includes('cola') && parentId) {
      const [descabezadoBasura] = await conmysql.query('SELECT SUM(descabezado_basura) as basura FROM descabezado WHERE lote_id = ?', [parentId]);
      basura_parent += descabezadoBasura[0].basura || 0;

      const [peladoBasura] = await conmysql.query('SELECT SUM(pelado_basura) as basura FROM pelado WHERE lote_id = ?', [parentId]);
      basura_parent += peladoBasura[0].basura || 0;
    }

    const total_basura = (ingresotunel_basura || 0) + basura_parent;

    let ingresotunel_rendimiento = 0;
    const empacado = ingresotunel_total || 0;
    if (loteTipo.includes('entero')) {
      ingresotunel_rendimiento = promedio > 0 ? ((empacado - (ingresotunel_sobrante || 0)) / promedio * 100).toFixed(2) : 0;
    } else {
      ingresotunel_rendimiento = promedio > 0 ? (empacado / (promedio - total_basura) * 100).toFixed(2) : 0;
    }

    // Actualizar el ingreso
    const [updateResult] = await conmysql.query(
      `UPDATE ingresotunel SET
        lote_id = ?, usuario_id = ?, proveedor_id = ?, tipo_id = ?, clase_id = ?, color_id = ?, corte_id = ?,
        talla_id = ?, peso_id = ?, glaseo_id = ?, presentacion_id = ?, orden_id = ?, maquina_id = ?, grupo_id = ?,
        coche_id = ?, c_calidad_id = ?, defectos_id = ?, ingresotunel_peso_neto = ?, ingresotunel_n_cajas = ?,
        ingresotunel_libras_netas = ?, ingresotunel_subtotales = ?, ingresotunel_total = ?, ingresotunel_sobrante = ?,
        ingresotunel_basura = ?, ingresotunel_rendimiento = ?, ingresotunel_observaciones = ?
      WHERE ingresotunel_id = ?`,
      [
        lote_id, usuario_id, proveedor_id, tipo_id, clase_id, color_id, corte_id,
        talla_id, peso_id, glaseo_id, presentacion_id, orden_id, maquina_id, grupo_id,
        coche_id, c_calidad_id, defectos_id, ingresotunel_peso_neto, ingresotunel_n_cajas,
        ingresotunel_libras_netas, ingresotunel_subtotales, ingresotunel_total, ingresotunel_sobrante,
        ingresotunel_basura, ingresotunel_rendimiento, ingresotunel_observaciones, id
      ]
    );

    if (updateResult.affectedRows <= 0) return res.status(404).json({ message: "Ingreso de Túnel no encontrado" });

    // Ajustar pendientes en nuevo orden
    await updateOrdenPendientes(orden_id, -ingresotunel_total);

    // Actualizar estado del coche si cambió
    await conmysql.query('UPDATE coche SET coche_estado = "En túnel" WHERE coche_id = ?', [coche_id]);

    // Reset timer si necesario (simplificado, no maneja cancelación de old timer)

    setTimeout(async () => {
      try {
        await conmysql.query('UPDATE coche SET coche_estado = "Disponible" WHERE coche_id = ?', [coche_id]);
        global._io.emit('coche_disponible', { coche_id });
      } catch (error) {
        console.error('Error al actualizar estado de coche:', error);
      }
    }, 7200000);

    // Obtener registro actualizado
    const [actualizado] = await conmysql.query(`
      SELECT i.*, 
        l.lote_codigo, l.lote_libras_remitidas, l.lote_peso_promedio, l.clase_id as lote_clase_id, l.color_id as lote_color_id,
        t.tipo_descripcion as lote_tipo,
        u.usuario_nombre, 
        pr.proveedor_nombre, 
        ty.tipo_descripcion,
        cl.clase_descripcion, 
        co.color_descripcion, 
        cr.corte_descripcion, 
        ta.talla_descripcion, 
        pe.peso_descripcion,
        g.glaseo_cantidad, 
        p.presentacion_descripcion, 
        o.orden_codigo, o.orden_estado, o.orden_total_master,
        m.maquina_descripcion, 
        gr.grupo_nombre,
        ch.coche_descripcion, ch.coche_estado,
        cal.c_calidad_peso_bruto, cal.c_calidad_peso_neto, cal.c_calidad_uniformidad,
        cal.c_calidad_olor, cal.c_calidad_sabor, cal.c_calidad_observaciones,
        def.defectos_total_defectos, def.defectos_observaciones, def.defectos_acciones_correctivas
      FROM ingresotunel i
      LEFT JOIN lote l ON i.lote_id = l.lote_id
      LEFT JOIN tipo t ON l.tipo_id = t.tipo_id
      LEFT JOIN usuario u ON i.usuario_id = u.usuario_id
      LEFT JOIN proveedor pr ON i.proveedor_id = pr.proveedor_id
      LEFT JOIN tipo ty ON i.tipo_id = ty.tipo_id
      LEFT JOIN clase cl ON i.clase_id = cl.clase_id
      LEFT JOIN color co ON i.color_id = co.color_id
      LEFT JOIN corte cr ON i.corte_id = cr.corte_id
      LEFT JOIN talla ta ON i.talla_id = ta.talla_id
      LEFT JOIN peso pe ON i.peso_id = pe.peso_id
      LEFT JOIN glaseo g ON i.glaseo_id = g.glaseo_id
      LEFT JOIN presentacion p ON i.presentacion_id = p.presentacion_id
      LEFT JOIN orden o ON i.orden_id = o.orden_id
      LEFT JOIN maquina m ON i.maquina_id = m.maquina_id
      LEFT JOIN grupo gr ON i.grupo_id = gr.grupo_id
      LEFT JOIN coche ch ON i.coche_id = ch.coche_id
      LEFT JOIN control_calidad cal ON i.c_calidad_id = cal.c_calidad_id
      LEFT JOIN defectos def ON i.defectos_id = def.defectos_id
      WHERE i.ingresotunel_id = ?
    `, [id]);

    // Emitir WebSocket
    global._io.emit("ingreso_tunel_actualizado", actualizado[0]);

    res.json(actualizado[0]);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// PATCH: Actualización parcial, recalcular si campos relevantes cambian
export const pathIngresoTunel = async (req, res) => {
  try {
    const { id } = req.params;
    const campos = Object.keys(req.body);
    const valores = Object.values(req.body);

    if (campos.length === 0) return res.status(400).json({ message: "No se enviaron campos para actualizar" });

    // Obtener actual para revertir si necesario
    const [actual] = await conmysql.query('SELECT orden_id, ingresotunel_total FROM ingresotunel WHERE ingresotunel_id = ?', [id]);
    const viejoOrdenId = actual[0].orden_id;
    const viejoTotal = actual[0].ingresotunel_total || 0;

    const setClause = campos.map(campo => `${campo} = IFNULL(?, ${campo})`).join(', ');
    const [updateResult] = await conmysql.query(
      `UPDATE ingresotunel SET ${setClause} WHERE ingresotunel_id = ?`,
      [...valores, id]
    );

    if (updateResult.affectedRows <= 0) return res.status(404).json({ message: "Ingreso de Túnel no encontrado" });

    // Recalcular rendimiento si campos relevantes cambiaron
    if (campos.some(c => ['lote_id', 'ingresotunel_total', 'ingresotunel_sobrante', 'ingresotunel_basura'].includes(c))) {
      const [updated] = await conmysql.query('SELECT * FROM ingresotunel WHERE ingresotunel_id = ?', [id]);
      const loteId = updated[0].lote_id;

      const [lote] = await conmysql.query('SELECT lote_peso_promedio, tipo_id, parent_lote_id FROM lote WHERE lote_id = ?', [loteId]);
      const promedio = lote[0].lote_peso_promedio || 0;
      const loteTipoId = lote[0].tipo_id;
      const parentId = lote[0].parent_lote_id || 0;

      const [tipo] = await conmysql.query('SELECT tipo_descripcion FROM tipo WHERE tipo_id = ?', [loteTipoId]);
      const loteTipo = tipo[0].tipo_descripcion.toLowerCase();

      let basura_parent = 0;
      if (loteTipo.includes('cola') && parentId) {
        const [descabezadoBasura] = await conmysql.query('SELECT SUM(descabezado_basura) as basura FROM descabezado WHERE lote_id = ?', [parentId]);
        basura_parent += descabezadoBasura[0].basura || 0;

        const [peladoBasura] = await conmysql.query('SELECT SUM(pelado_basura) as basura FROM pelado WHERE lote_id = ?', [parentId]);
        basura_parent += peladoBasura[0].basura || 0;
      }

      const total_basura = (updated[0].ingresotunel_basura || 0) + basura_parent;

      let rendimiento = 0;
      const empacado = updated[0].ingresotunel_total || 0;
      if (loteTipo.includes('entero')) {
        rendimiento = promedio > 0 ? ((empacado - (updated[0].ingresotunel_sobrante || 0)) / promedio * 100).toFixed(2) : 0;
      } else {
        rendimiento = promedio > 0 ? (empacado / (promedio - total_basura) * 100).toFixed(2) : 0;
      }

      await conmysql.query('UPDATE ingresotunel SET ingresotunel_rendimiento = ? WHERE ingresotunel_id = ?', [rendimiento, id]);
    }

    // Ajustar pendientes si total u orden cambiaron
    if (campos.includes('ingresotunel_total') || campos.includes('orden_id')) {
      const [updated] = await conmysql.query('SELECT orden_id, ingresotunel_total FROM ingresotunel WHERE ingresotunel_id = ?', [id]);
      const nuevoOrdenId = updated[0].orden_id;
      const nuevoTotal = updated[0].ingresotunel_total || 0;

      if (viejoOrdenId !== nuevoOrdenId) {
        await updateOrdenPendientes(viejoOrdenId, viejoTotal); // Revertir viejo
      }

      await updateOrdenPendientes(nuevoOrdenId, -nuevoTotal); // Aplicar nuevo
    }

    // Obtener actualizado
    const [actualizado] = await conmysql.query(`
      SELECT i.*, 
        l.lote_codigo, l.lote_libras_remitidas, l.lote_peso_promedio, l.clase_id as lote_clase_id, l.color_id as lote_color_id,
        t.tipo_descripcion as lote_tipo,
        u.usuario_nombre, 
        pr.proveedor_nombre, 
        ty.tipo_descripcion,
        cl.clase_descripcion, 
        co.color_descripcion, 
        cr.corte_descripcion, 
        ta.talla_descripcion, 
        pe.peso_descripcion,
        g.glaseo_cantidad, 
        p.presentacion_descripcion, 
        o.orden_codigo, o.orden_estado, o.orden_total_master,
        m.maquina_descripcion, 
        gr.grupo_nombre,
        ch.coche_descripcion, ch.coche_estado,
        cal.c_calidad_peso_bruto, cal.c_calidad_peso_neto, cal.c_calidad_uniformidad,
        cal.c_calidad_olor, cal.c_calidad_sabor, cal.c_calidad_observaciones,
        def.defectos_total_defectos, def.defectos_observaciones, def.defectos_acciones_correctivas
      FROM ingresotunel i
      LEFT JOIN lote l ON i.lote_id = l.lote_id
      LEFT JOIN tipo t ON l.tipo_id = t.tipo_id
      LEFT JOIN usuario u ON i.usuario_id = u.usuario_id
      LEFT JOIN proveedor pr ON i.proveedor_id = pr.proveedor_id
      LEFT JOIN tipo ty ON i.tipo_id = ty.tipo_id
      LEFT JOIN clase cl ON i.clase_id = cl.clase_id
      LEFT JOIN color co ON i.color_id = co.color_id
      LEFT JOIN corte cr ON i.corte_id = cr.corte_id
      LEFT JOIN talla ta ON i.talla_id = ta.talla_id
      LEFT JOIN peso pe ON i.peso_id = pe.peso_id
      LEFT JOIN glaseo g ON i.glaseo_id = g.glaseo_id
      LEFT JOIN presentacion p ON i.presentacion_id = p.presentacion_id
      LEFT JOIN orden o ON i.orden_id = o.orden_id
      LEFT JOIN maquina m ON i.maquina_id = m.maquina_id
      LEFT JOIN grupo gr ON i.grupo_id = gr.grupo_id
      LEFT JOIN coche ch ON i.coche_id = ch.coche_id
      LEFT JOIN control_calidad cal ON i.c_calidad_id = cal.c_calidad_id
      LEFT JOIN defectos def ON i.defectos_id = def.defectos_id
      WHERE i.ingresotunel_id = ?
    `, [id]);

    // Emitir WebSocket
    global._io.emit("ingreso_tunel_actualizado", actualizado[0]);

    res.json(actualizado[0]);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// DELETE: Eliminar ingreso, revertir pendientes, emitir WS
export const deleteIngresoTunel = async (req, res) => {
  try {
    const { id } = req.params;

    // Obtener datos para revertir
    const [actual] = await conmysql.query('SELECT orden_id, ingresotunel_total, coche_id FROM ingresotunel WHERE ingresotunel_id = ?', [id]);
    if (actual.length === 0) return res.status(404).json({ message: "Ingreso de Túnel no encontrado" });
    const ordenId = actual[0].orden_id;
    const total = actual[0].ingresotunel_total || 0;
    const cocheId = actual[0].coche_id;

    // Revertir pendientes
    await updateOrdenPendientes(ordenId, total);

    // Eliminar
    await conmysql.query('DELETE FROM ingresotunel WHERE ingresotunel_id = ?', [id]);

    // Reset estado coche si necesario
    await conmysql.query('UPDATE coche SET coche_estado = "Disponible" WHERE coche_id = ?', [cocheId]);

    // Emitir WebSocket
    global._io.emit("ingreso_tunel_eliminado", { ingresotunel_id: parseInt(id) });

    res.status(202).json({ message: "Ingreso de Túnel eliminado con éxito" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// GET Rendimiento por lote (acumulado de todos los coches/ingresos del lote)
export const getRendimientoLote = async (req, res) => {
  try {
    const { lote_id } = req.query;
    if (!lote_id) return res.status(400).json({ message: "lote_id required" });

    const [lote] = await conmysql.query('SELECT lote_peso_promedio, tipo_id, parent_lote_id FROM lote WHERE lote_id = ?', [lote_id]);
    if (lote.length === 0) return res.status(404).json({ message: "Lote no encontrado" });
    const promedio = lote[0].lote_peso_promedio || 0;
    const loteTipoId = lote[0].tipo_id;
    const parentId = lote[0].parent_lote_id || 0;

    const [tipo] = await conmysql.query('SELECT tipo_descripcion FROM tipo WHERE tipo_id = ?', [loteTipoId]);
    const loteTipo = tipo[0].tipo_descripcion.toLowerCase();

    // Sumar todos los ingresos del lote
    const [aggreg] = await conmysql.query(`
      SELECT SUM(ingresotunel_total) as total, SUM(ingresotunel_sobrante) as sobrante, SUM(ingresotunel_basura) as basura 
      FROM ingresotunel WHERE lote_id = ?
    `, [lote_id]);
    const total = aggreg[0].total || 0;
    const sobrante = aggreg[0].sobrante || 0;
    const basura = aggreg[0].basura || 0;

    let basura_parent = 0;
    if (loteTipo.includes('cola') && parentId) {
      const [descabezadoBasura] = await conmysql.query('SELECT SUM(descabezado_basura) as basura FROM descabezado WHERE lote_id = ?', [parentId]);
      basura_parent += descabezadoBasura[0].basura || 0;

      const [peladoBasura] = await conmysql.query('SELECT SUM(pelado_basura) as basura FROM pelado WHERE lote_id = ?', [parentId]);
      basura_parent += peladoBasura[0].basura || 0;
    }

    const total_basura = basura + basura_parent;

    let rendimiento = 0;
    if (loteTipo.includes('entero')) {
      rendimiento = promedio > 0 ? ((total - sobrante) / promedio * 100).toFixed(2) : 0;
    } else {
      rendimiento = promedio > 0 ? (total / (promedio - total_basura) * 100).toFixed(2) : 0;
    }

    res.json({ rendimiento, total_empacado: total, total_sobrante: sobrante, total_basura });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Helper: Actualizar libras pendientes en orden y verificar cumplimiento
async function updateOrdenPendientes(orden_id, delta) {
  if (!orden_id) return;

  const [actual] = await conmysql.query('SELECT orden_libras_pendientes FROM orden WHERE orden_id = ?', [orden_id]);
  let pendientes = (actual[0].orden_libras_pendientes || 0) + delta;

  let estado = pendientes > 0 ? 'pendiente' : 'cumplida';

  await conmysql.query('UPDATE orden SET orden_libras_pendientes = ?, orden_estado = ? WHERE orden_id = ?', [pendientes, estado, orden_id]);

  const [orden] = await conmysql.query('SELECT * FROM orden WHERE orden_id = ?', [orden_id]);
  global._io.emit("orden_actualizada", orden[0]);

  if (estado === 'cumplida') {
    global._io.emit("orden_cumplida", orden[0]);
  }
} */



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
};