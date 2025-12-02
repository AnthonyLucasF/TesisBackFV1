// src/controladores/trazabilidadCtrl.js
import { conmysql } from "../db.js";

/**
 * Función interna que arma TODO el historial del lote
 * y devuelve el JSON con la estructura que espera el FRONT:
 *
 * {
 *   lote: {...},
 *   calidad: [],
 *   clasificacion: [],
 *   descabezado: [],
 *   pelado: [],
 *   ingreso_tunel: [],
 *   masterizado: [],
 *   liquidaciones: []
 * }
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
      l.lote_hora_ingreso,
      l.lote_peso_promedio
    FROM lote l
    LEFT JOIN proveedor pr ON pr.proveedor_id = l.proveedor_id
    WHERE l.lote_id = ?
    `,
    [lote_id]
  );

  if (!recepcion.length) {
    const err = new Error("Lote no encontrado");
    err.code = 404;
    throw err;
  }

  const lote = recepcion[0];

  // ------------------------------
  // 2️⃣ CONTROL DE CALIDAD
  //    (alias para que cuadre con el front)
  // ------------------------------
  const [calidad] = await conmysql.query(
    `
    SELECT 
      cc.*,
      u.usuario_nombre,
      -- armamos un "c_calidad_fecha" con la fecha del lote + hora de control
      CONCAT(l.lote_fecha_ingreso, ' ', IFNULL(cc.c_calidad_hora_control, '00:00:00')) AS c_calidad_fecha
    FROM control_calidad cc
    LEFT JOIN usuario u ON u.usuario_id = cc.usuario_id
    LEFT JOIN lote l ON l.lote_id = cc.lote_id
    WHERE cc.lote_id = ?
    ORDER BY cc.c_calidad_id ASC
    `,
    [lote_id]
  );

  // ------------------------------
  // 3️⃣ CLASIFICACIÓN (detalle)
  //    se necesitan clase_descripcion y talla_descripcion
  // ------------------------------
  const [clasificacion] = await conmysql.query(
    `
    SELECT 
      cl.*,
      t.talla_descripcion,
      c.clase_descripcion
    FROM clasificacion cl
    LEFT JOIN talla t   ON t.talla_id  = cl.talla_id
    LEFT JOIN clase c   ON c.clase_id  = cl.clase_id
    WHERE cl.lote_id = ?
    ORDER BY cl.clasificacion_fecha ASC
    `,
    [lote_id]
  );

  // ------------------------------
  // 4️⃣ DESCABEZADO
  //    alias: descabezado_libras_descabezadas -> descabezado_libras
  // ------------------------------
  const [descabezado] = await conmysql.query(
    `
    SELECT 
      d.*,
      u.usuario_nombre,
      ch.coche_descripcion,
      d.descabezado_libras_descabezadas AS descabezado_libras
    FROM descabezado d
    LEFT JOIN usuario u ON u.usuario_id = d.usuario_id
    LEFT JOIN coche   ch ON ch.coche_id  = d.coche_id
    WHERE d.lote_id = ?
    ORDER BY d.descabezado_fecha ASC
    `,
    [lote_id]
  );

  // ------------------------------
  // 5️⃣ PELADO
  //    alias: pelado_libras_peladas -> pelado_libras
  // ------------------------------
  const [pelado] = await conmysql.query(
    `
    SELECT 
      p.*,
      u.usuario_nombre,
      ch.coche_descripcion,
      p.pelado_libras_peladas AS pelado_libras
    FROM pelado p
    LEFT JOIN usuario u ON u.usuario_id = p.usuario_id
    LEFT JOIN coche   ch ON ch.coche_id  = p.coche_id
    WHERE p.lote_id = ?
    ORDER BY p.pelado_fecha ASC
    `,
    [lote_id]
  );

  // ------------------------------
  // 6️⃣ INGRESO A TÚNEL (detalle)
  //    se usan: clase, talla, presentacion, peso, glaseo, coche_descripcion...
  // ------------------------------
  const [ingreso_tunel] = await conmysql.query(
    `
    SELECT 
      it.*,
      t.talla_descripcion AS talla,
      c.clase_descripcion AS clase,
      col.color_descripcion AS color,
      co.corte_descripcion AS corte,
      p.peso_descripcion   AS peso,
      pr.presentacion_descripcion AS presentacion,
      g.glaseo_cantidad    AS glaseo,
      ch.coche_descripcion,
      u.usuario_nombre
    FROM ingresotunel it
    LEFT JOIN talla        t  ON it.talla_id        = t.talla_id
    LEFT JOIN clase        c  ON it.clase_id        = c.clase_id
    LEFT JOIN color        col ON it.color_id       = col.color_id
    LEFT JOIN corte        co  ON it.corte_id       = co.corte_id
    LEFT JOIN peso         p   ON it.peso_id        = p.peso_id
    LEFT JOIN glaseo       g   ON it.glaseo_id      = g.glaseo_id
    LEFT JOIN presentacion pr  ON it.presentacion_id = pr.presentacion_id
    LEFT JOIN coche        ch  ON it.coche_id       = ch.coche_id
    LEFT JOIN usuario      u   ON it.usuario_id     = u.usuario_id
    WHERE it.lote_id = ?
    ORDER BY it.ingresotunel_fecha ASC
    `,
    [lote_id]
  );

  // ------------------------------
  // 7️⃣ MASTERIZADO
  //    alias para que coincida con el HTML:
  //    master_tipo, master_total_libras, master_total_cajas, master_cantidad
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
      m.master_type              AS master_tipo,
      m.masterizado_total_libras AS master_total_libras,
      m.masterizado_total_cajas  AS master_total_cajas,
      m.masterizado_total_master AS master_cantidad,
      m.masterizado_fecha,
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
  // 8️⃣ LIQUIDACIONES (ENTERO / COLA)
  //    el front espera un array "liquidaciones" y luego hace .find(...)
  // ------------------------------
  const [liqEntero] = await conmysql.query(
    `
    SELECT * 
    FROM liquidacion
    WHERE lote_id = ? AND liquidacion_tipo = 'Camarón Entero'
    `,
    [lote_id]
  );

  const [liqCola] = await conmysql.query(
    `
    SELECT * 
    FROM liquidacion
    WHERE lote_id = ? AND liquidacion_tipo = 'Camarón Cola'
    `,
    [lote_id]
  );

  const liquidaciones = [
    ...(liqEntero[0] ? [liqEntero[0]] : []),
    ...(liqCola[0]   ? [liqCola[0]]   : [])
  ];

  // ------------------------------
  // Objeto FINAL (estructura que espera Angular)
  // ------------------------------
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

// =========================================================
//  GET /api/trazabilidad/id/:lote_id
//  (y/o /api/trazabilidad/:lote_id según el router)
// =========================================================
export const getHistorialLote = async (req, res) => {
  try {
    const { lote_id } = req.params;

    const data = await buildHistorialLote(lote_id);
    return res.json(data);

  } catch (err) {
    console.error("Error Trazabilidad (por ID):", err);

    if (err.code === 404) {
      return res.status(404).json({ message: "Lote no encontrado" });
    }

    return res.status(500).json({ message: err.message });
  }
};

// =========================================================
//  GET /api/trazabilidad/codigo/:codigo
//  Para buscar por código de lote (C-006-2025, etc.)
//  Coincide con fun_getHistorialPorCodigo(codigo)
// =========================================================
export const getHistorialLotePorCodigo = async (req, res) => {
  try {
    const { codigo } = req.params;

    // Buscamos el lote_id por el código
    const [rows] = await conmysql.query(
      `
      SELECT lote_id
      FROM lote
      WHERE lote_codigo = ?
      `,
      [codigo]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Lote no encontrado para ese código" });
    }

    const lote_id = rows[0].lote_id;

    const data = await buildHistorialLote(lote_id);
    return res.json(data);

  } catch (err) {
    console.error("Error Trazabilidad (por código):", err);
    return res.status(500).json({ message: err.message });
  }
};
