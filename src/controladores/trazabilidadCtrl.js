import { conmysql } from "../db.js";

/**
 * Construye todo el historial de un lote a partir de su ID.
 */
async function buildHistorialLote(lote_id) {

  // 1) RECEPCIÓN DEL LOTE
  const [recepcion] = await conmysql.query(`
    SELECT 
      l.*,
      pr.proveedor_nombre
    FROM lote l
    LEFT JOIN proveedor pr ON pr.proveedor_id = l.proveedor_id
    WHERE l.lote_id = ?
  `, [lote_id]);

  if (!recepcion.length)
    return null;

  const lote = recepcion[0];

  // 2) CONTROL DE CALIDAD + DEFECTOS
  const [calidad] = await conmysql.query(`
  SELECT 
    cc.*,
    u.usuario_nombre,
    col.color_descripcion,

    JSON_OBJECT(
      'cabeza_roja', d.defectos_cabeza_roja,
      'cabeza_naranja', d.defectos_cabeza_naranja,
      'cabeza_floja', d.defectos_cabeza_floja,
      'hepato_reventado', d.defectos_hepato_reventado,
      'corbata', d.defectos_corbata,
      'deformes', d.defectos_deformes,
      'deshidratado_leve', d.defectos_deshidratado_leve,
      'deshidratado_moderado', d.defectos_deshidratado_moderado,
      'deterioro', d.defectos_deterioro,
      'rojo', d.defectos_rojo,
      'juvenil', d.defectos_juvenil,
      'flacido', d.defectos_flacido,
      'mudado', d.defectos_mudado,
      'mal_descabezado', d.defectos_mal_descabezado,
      'mezclas_especies', d.defectos_mezclas_de_especies,
      'necrosis_leve', d.defectos_necrosis_leve,
      'necrosis_moderada', d.defectos_necrosis_moderada,
      'quebrado', d.defectos_quebrado,
      'pequenios', d.defectos_pequenios,
      'melanosis', d.defectos_melanosis,
      'segmento_separado', d.defectos_3er_segmento_separado,
      'porc_cascara', d.defectos_porcentaje_cascara,
      'porc_intestino', d.defectos_porcentaje_intestino,
      'porc_sin_telon', d.defectos_porcentaje_sin_telon,
      'porc_falta_corte', d.defectos_porcentaje_falta_de_corte,
      'porc_corte_profundo', d.defectos_porcentaje_corte_profundo,
      'porc_corte_desviado', d.defectos_porcentaje_corte_desviado,
      'basura', d.defectos_basura,
      'total_defectos', d.defectos_total_defectos,
      'observaciones', d.defectos_observaciones,
      'acciones_correctivas', d.defectos_acciones_correctivas
    ) AS defectos

  FROM control_calidad cc
  LEFT JOIN usuario u ON u.usuario_id = cc.usuario_id
  LEFT JOIN color col ON col.color_id = cc.color_id
  LEFT JOIN defectos d ON d.defectos_id = cc.defectos_id
  WHERE cc.lote_id = ?
  ORDER BY cc.c_calidad_id ASC
`, [lote_id]);

  // 3) CLASIFICACIÓN
  const [clasificacion] = await conmysql.query(`
    SELECT 
      cl.*,
      c.clase_descripcion,
      t.talla_descripcion,
      p.peso_descripcion,
      co.corte_descripcion,
      col.color_descripcion
    FROM clasificacion cl
    LEFT JOIN clase c ON c.clase_id = cl.clase_id
    LEFT JOIN talla t ON t.talla_id = cl.talla_id
    LEFT JOIN peso p ON p.peso_id = cl.peso_id
    LEFT JOIN corte co ON co.corte_id = cl.corte_id
    LEFT JOIN color col ON col.color_id = cl.color_id
    WHERE cl.lote_id = ?
    ORDER BY cl.clasificacion_fecha ASC
  `, [lote_id]);

  // 4) DESCABEZADO
  const [descabezado] = await conmysql.query(`
    SELECT 
      d.*,
      ch.coche_descripcion,
      u.usuario_nombre
    FROM descabezado d
    LEFT JOIN coche ch ON ch.coche_id = d.coche_id
    LEFT JOIN usuario u ON u.usuario_id = d.usuario_id
    WHERE d.lote_id = ?
    ORDER BY d.descabezado_fecha ASC
  `, [lote_id]);

  // 5) PELADO
  const [pelado] = await conmysql.query(`
    SELECT 
      p.*,
      ch.coche_descripcion,
      u.usuario_nombre
    FROM pelado p
    LEFT JOIN coche ch ON ch.coche_id = p.coche_id
    LEFT JOIN usuario u ON u.usuario_id = p.usuario_id
    WHERE p.lote_id = ?
    ORDER BY p.pelado_fecha ASC
  `, [lote_id]);

  // 6) INGRESO TÚNEL
  const [ingreso_tunel] = await conmysql.query(`
    SELECT 
      it.*,
      t.talla_descripcion AS talla,
      c.clase_descripcion AS clase,
      col.color_descripcion AS color,
      co.corte_descripcion AS corte,
      p.peso_descripcion AS peso,
      pr.presentacion_descripcion AS presentacion,
      g.glaseo_cantidad AS glaseo,
      ch.coche_descripcion
    FROM ingresotunel it
    LEFT JOIN talla t ON it.talla_id = t.talla_id
    LEFT JOIN clase c ON it.clase_id = c.clase_id
    LEFT JOIN color col ON it.color_id = col.color_id
    LEFT JOIN corte co ON it.corte_id = co.corte_id
    LEFT JOIN peso p ON it.peso_id = p.peso_id
    LEFT JOIN presentacion pr ON it.presentacion_id = pr.presentacion_id
    LEFT JOIN glaseo g ON it.glaseo_id = g.glaseo_id
    LEFT JOIN coche ch ON it.coche_id = ch.coche_id
    WHERE it.lote_id = ?
    ORDER BY it.ingresotunel_fecha ASC
  `, [lote_id]);

  // 7) MASTERIZADO
  const [masterizado] = await conmysql.query(`
    SELECT 
      m.*,
      u.usuario_nombre,
      ch.coche_descripcion
    FROM masterizado m
    LEFT JOIN usuario u ON u.usuario_id = m.usuario_id
    LEFT JOIN coche ch ON ch.coche_id = m.coche_id
    WHERE m.lote_id = ?
    ORDER BY m.masterizado_fecha ASC
  `, [lote_id]);

  // 8) LIQUIDACIONES
  const [liquidaciones] = await conmysql.query(`
    SELECT *
    FROM liquidacion
    WHERE lote_id = ?
    ORDER BY liquidacion_fecha ASC
  `, [lote_id]);


  return {
    lote,
    calidad,
    clasificacion,
    descabezado,
    pelado,
    ingreso_tunel,
    masterizado,
    liquidaciones
  };
}

// RUTA PRINCIPAL
export const getHistorialLote = async (req, res) => {
  try {
    const { lote_id } = req.params;

    const data = await buildHistorialLote(lote_id);
    if (!data)
      return res.status(404).json({ message: "Lote no encontrado" });

    res.json(data);

  } catch (err) {
    console.error("Error Trazabilidad:", err);
    res.status(500).json({ message: err.message });
  }
};

// LISTADO GENERAL
export const getListadoGeneralHistorial = async (req, res) => {
  try {
    const [rows] = await conmysql.query(`
      SELECT 
        l.lote_id,
        l.lote_codigo,
        pr.proveedor_nombre,
        l.lote_libras_remitidas,
        l.lote_fecha_ingreso,
        l.lote_peso_promedio
      FROM lote l
      LEFT JOIN proveedor pr ON pr.proveedor_id = l.proveedor_id
      ORDER BY l.lote_id DESC
    `);

    res.json(rows);

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
