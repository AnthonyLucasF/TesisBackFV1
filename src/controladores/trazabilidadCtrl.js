import { conmysql } from "../db.js";

/**
 * Construye todo el historial de un lote a partir de su ID.
 * Devuelve un objeto listo para consumir por el front de trazabilidad.
 */
async function buildHistorialLote(lote_id) {
  // ------------------------------
  // 1️⃣ RECEPCIÓN (LOTE)
  // ------------------------------
  const [recepcion] = await conmysql.query(
    `
    SELECT 
      l.lote_id,
      l.lote_codigo,
      l.lote_libras_remitidas,
      l.lote_n_bines,
      l.lote_n_piscina,
      pr.proveedor_nombre,
      l.lote_fecha_ingreso,
      l.lote_hora_ingreso
    FROM lote l
    LEFT JOIN proveedor pr ON pr.proveedor_id = l.proveedor_id
    WHERE l.lote_id = ?
    `,
    [lote_id]
  );

  if (!recepcion.length) {
    return null; // se maneja en el controlador como 404
  }

  const lote = recepcion[0];

  // ------------------------------
  // 2️⃣ CONTROL DE CALIDAD
  // ------------------------------
  const [calidad] = await conmysql.query(
    `
    SELECT 
      cc.c_calidad_id,
      cc.usuario_id,
      cc.lote_id,
      cc.tipo_id,
      cc.clase_id,
      cc.c_calidad_hora_control,
      CONCAT(l.lote_fecha_ingreso, ' ', cc.c_calidad_hora_control) AS c_calidad_fecha,
      cc.c_calidad_talla_real,
      cc.c_calidad_talla_marcada,
      cc.c_calidad_peso_bruto,
      cc.c_calidad_peso_neto,
      cc.c_calidad_cuenta_x_libra,
      cc.c_calidad_total,
      cc.c_calidad_uniformidad,
      cc.c_calidad_olor,
      cc.c_calidad_sabor,
      cc.c_calidad_observaciones,
      cc.defectos_id,
      cc.c_calidad_codigo,
      cc.color_id,
      cc.proveedor_id,
      u.usuario_nombre,
      col.color_descripcion AS color_descripcion
    FROM control_calidad cc
    LEFT JOIN usuario u ON u.usuario_id = cc.usuario_id
    LEFT JOIN lote l ON l.lote_id = cc.lote_id
    LEFT JOIN color col ON col.color_id = cc.color_id
    WHERE cc.lote_id = ?
    ORDER BY cc.c_calidad_id ASC
    `,
    [lote_id]
  );

  // ------------------------------
  // 3️⃣ CLASIFICACIÓN
  // ------------------------------
  const [clasificacion] = await conmysql.query(
    `
    SELECT
      cl.clasificacion_id,
      cl.lote_id,
      cl.clasificacion_fecha,
      cl.clasificacion_libras_netas AS clasificacion_libras,
      cl.clasificacion_n_cajas,
      cl.clasificacion_sobrante,
      cl.clasificacion_basura,
      cl.rendimiento,
      cl.tipo_rendimiento,
      c.clase_descripcion,
      t.talla_descripcion
    FROM clasificacion cl
    LEFT JOIN clase c ON c.clase_id = cl.clase_id
    LEFT JOIN talla t ON t.talla_id = cl.talla_id
    WHERE cl.lote_id = ?
    ORDER BY cl.clasificacion_fecha ASC
    `,
    [lote_id]
  );

  // ------------------------------
  // 4️⃣ DESCABEZADO
  // ------------------------------
  const [descabezado] = await conmysql.query(
    `
    SELECT
      d.descabezado_id,
      d.lote_id,
      d.usuario_id,
      d.orden_id,
      d.coche_id,
      d.descabezado_libras_descabezadas AS descabezado_libras,
      d.descabezado_basura,
      d.descabezado_rendimiento,
      d.descabezado_fecha,
      d.descabezado_observaciones,
      ch.coche_descripcion
    FROM descabezado d
    LEFT JOIN coche ch ON ch.coche_id = d.coche_id
    WHERE d.lote_id = ?
    ORDER BY d.descabezado_fecha ASC
    `,
    [lote_id]
  );

  // ------------------------------
  // 5️⃣ PELADO
  // ------------------------------
  const [pelado] = await conmysql.query(
    `
    SELECT
      p.pelado_id,
      p.lote_id,
      p.usuario_id,
      p.orden_id,
      p.coche_id,
      p.pelado_libras_peladas AS pelado_libras,
      p.pelado_basura,
      p.pelado_rendimiento,
      p.pelado_fecha,
      p.pelado_observaciones,
      ch.coche_descripcion
    FROM pelado p
    LEFT JOIN coche ch ON ch.coche_id = p.coche_id
    WHERE p.lote_id = ?
    ORDER BY p.pelado_fecha ASC
    `,
    [lote_id]
  );

  // ------------------------------
  // 6️⃣ INGRESO TÚNEL
  // ------------------------------
  const [ingreso_tunel] = await conmysql.query(
    `
    SELECT 
      it.ingresotunel_id,
      it.lote_id,
      it.liquidacion_id,
      it.usuario_id,
      it.proveedor_id,
      it.tipo_id,
      it.clase_id,
      it.color_id,
      it.corte_id,
      it.talla_id,
      it.peso_id,
      it.glaseo_id,
      it.presentacion_id,
      it.orden_id,
      it.maquina_id,
      it.grupo_id,
      it.coche_id,
      it.c_calidad_id,
      it.defectos_id,
      it.ingresotunel_fecha,
      it.ingresotunel_peso_neto,
      it.ingresotunel_n_cajas           AS ingresotunel_cajas,
      it.ingresotunel_libras_netas,
      it.ingresotunel_subtotales,
      it.ingresotunel_total,
      it.ingresotunel_sobrante,
      it.ingresotunel_basura,
      it.ingresotunel_rendimiento,
      it.ingresotunel_observaciones,
      it.ingresotunel_libras_por_empacar,
      t.talla_descripcion               AS talla,
      c.clase_descripcion               AS clase,
      col.color_descripcion             AS color,
      co.corte_descripcion              AS corte,
      p.peso_descripcion                AS peso,
      g.glaseo_cantidad                 AS glaseo,
      pr.presentacion_descripcion       AS presentacion,
      ch.coche_descripcion
    FROM ingresotunel it
    LEFT JOIN talla        t  ON it.talla_id        = t.talla_id
    LEFT JOIN clase        c  ON it.clase_id        = c.clase_id
    LEFT JOIN color        col ON it.color_id       = col.color_id
    LEFT JOIN corte        co  ON it.corte_id       = co.corte_id
    LEFT JOIN peso         p   ON it.peso_id        = p.peso_id
    LEFT JOIN glaseo       g   ON it.glaseo_id      = g.glaseo_id
    LEFT JOIN presentacion pr  ON it.presentacion_id = pr.presentacion_id
    LEFT JOIN coche        ch  ON it.coche_id       = ch.coche_id
    WHERE it.lote_id = ?
    ORDER BY it.ingresotunel_fecha ASC
    `,
    [lote_id]
  );

  // ------------------------------
  // 7️⃣ MASTERIZADO
  // ------------------------------
  const [masterizado] = await conmysql.query(
    `
    SELECT 
      m.masterizado_id,
      m.lote_id,
      m.coche_id,
      ch.coche_descripcion,
      m.usuario_id,
      u.usuario_nombre,
      m.master_type                    AS master_tipo,
      m.masterizado_fecha,
      m.masterizado_total_libras       AS master_total_libras,
      m.masterizado_total_cajas        AS master_total_cajas,
      m.masterizado_total_master       AS master_cantidad,
      m.masterizado_observaciones,
      m.masterizado_estado
    FROM masterizado m
    LEFT JOIN coche   ch ON ch.coche_id   = m.coche_id
    LEFT JOIN usuario u  ON u.usuario_id  = m.usuario_id
    WHERE m.lote_id = ?
    ORDER BY m.masterizado_fecha ASC
    `,
    [lote_id]
  );

  // ------------------------------
  // 8️⃣ LIQUIDACIONES (ENTERO y COLA)
  // ------------------------------
  const [liquidaciones] = await conmysql.query(
    `
    SELECT 
      liq.liquidacion_id,
      liq.lote_id,
      liq.liquidacion_tipo,
      liq.total_libras,
      liq.total_cajas,
      liq.total_coches,
      liq.liquidacion_rendimiento,
      liq.liquidacion_basura,
      liq.liquidacion_total_libras,
      liq.liquidacion_sobrante,
      liq.observaciones,
      liq.fecha,
      liq.liquidacion_fecha
    FROM liquidacion liq
    WHERE liq.lote_id = ?
    ORDER BY liq.liquidacion_fecha ASC
    `,
    [lote_id]
  );

  // Estructura final que espera el FRONT
  return {
    lote,            // <--- this.data.lote
    calidad,         // <--- this.data.calidad
    clasificacion,   // <--- this.data.clasificacion
    descabezado,     // <--- this.data.descabezado
    pelado,          // <--- this.data.pelado
    ingreso_tunel,   // <--- this.data.ingreso_tunel
    masterizado,     // <--- this.data.masterizado
    liquidaciones    // <--- this.data.liquidaciones (array: Entero y Cola)
  };
}

// =========================================================
//  GET /trazabilidad/:lote_id
//  GET /trazabilidad/id/:lote_id   (para compatibilidad con tu service Angular)
// =========================================================
export const getHistorialLote = async (req, res) => {
  try {
    const { lote_id } = req.params;

    const data = await buildHistorialLote(lote_id);
    if (!data) {
      return res.status(404).json({ message: "Lote no encontrado" });
    }

    return res.json(data);
  } catch (err) {
    console.error("Error Trazabilidad:", err);
    return res.status(500).json({ message: err.message });
  }
};

// =========================================================
//  GET /trazabilidad/codigo/:codigo
//  Busca el lote por código (C-006-2025, etc.) y reutiliza buildHistorialLote
// =========================================================
export const getHistorialPorCodigo = async (req, res) => {
  try {
    const { codigo } = req.params;

    const [lotes] = await conmysql.query(
      `
      SELECT lote_id 
      FROM lote 
      WHERE lote_codigo = ?
      `,
      [codigo]
    );

    if (!lotes.length) {
      return res.status(404).json({ message: "Lote no encontrado para ese código" });
    }

    const lote_id = lotes[0].lote_id;
    const data = await buildHistorialLote(lote_id);

    if (!data) {
      return res.status(404).json({ message: "No se pudo construir el historial para ese lote" });
    }

    return res.json(data);
  } catch (err) {
    console.error("Error Trazabilidad (por código):", err);
    return res.status(500).json({ message: err.message });
  }
};
