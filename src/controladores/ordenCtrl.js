/* import { conmysql } from "../db.js";

// Obtiene la descripción real de la talla según talla_id
const getTallaDescripcionById = async (tallaId) => {
  const [rows] = await conmysql.query(
    "SELECT talla_descripcion FROM talla WHERE talla_id = ? LIMIT 1",
    [tallaId]
  );
  return rows.length ? rows[0].talla_descripcion : null;
};

// ==============================
// GET: Todas las órdenes
// (incluye talla_descripcion, peso_descripcion, glaseo_cantidad)
// ==============================
export const getOrden = async (req, res) => {
  try {
    const [result] = await conmysql.query(`
      SELECT 
        o.*,
        t.talla_descripcion,
        p.peso_descripcion,
        g.glaseo_cantidad,
        GREATEST(o.orden_total_libras - IFNULL(SUM(i.ingresotunel_total), 0), 0) AS orden_libras_pendientes,
        GREATEST(IFNULL(SUM(i.ingresotunel_total), 0) - o.orden_total_libras, 0) AS orden_libras_sobrantes
      FROM orden o
      LEFT JOIN talla t ON o.talla_id = t.talla_id
      LEFT JOIN peso p ON o.peso_id = p.peso_id
      LEFT JOIN glaseo g ON o.glaseo_id = g.glaseo_id
      LEFT JOIN ingresotunel i ON o.orden_id = i.orden_id
      GROUP BY o.orden_id
      ORDER BY o.orden_fecha_produccion DESC
    `);

    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al consultar Órdenes" });
  }
};

// ==============================
// GET: Orden por ID
// ==============================
export const getOrdenxid = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: "ID de orden inválido" });

    const [result] = await conmysql.query(
      `
      SELECT 
        o.*,
        t.talla_descripcion,
        p.peso_descripcion,
        g.glaseo_cantidad,
        GREATEST(o.orden_total_libras - IFNULL(SUM(i.ingresotunel_total), 0), 0) AS orden_libras_pendientes,
        GREATEST(IFNULL(SUM(i.ingresotunel_total), 0) - o.orden_total_libras, 0) AS orden_libras_sobrantes
      FROM orden o
      LEFT JOIN talla t ON o.talla_id = t.talla_id
      LEFT JOIN peso p ON o.peso_id = p.peso_id
      LEFT JOIN glaseo g ON o.glaseo_id = g.glaseo_id
      LEFT JOIN ingresotunel i ON o.orden_id = i.orden_id
      WHERE o.orden_id = ?
      GROUP BY o.orden_id
      `,
      [id]
    );

    if (!result.length)
      return res.status(404).json({ orden_id: 0, message: "Orden no encontrada" });

    res.json(result[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error del Servidor" });
  }
};

// ==============================
// GET: Órdenes pendientes por talla
// ==============================
export const getOrdenesPendientes = async (req, res) => {
  try {
    const { talla_id } = req.query;
    const tallaId = Number(talla_id);

    if (!tallaId) return res.status(400).json({ message: "talla_id required" });

    const [result] = await conmysql.query(
      `
      SELECT 
        o.*,
        t.talla_descripcion,
        p.peso_descripcion,
        g.glaseo_cantidad,
        GREATEST(o.orden_total_libras - IFNULL(SUM(i.ingresotunel_total), 0), 0) AS orden_libras_pendientes,
        GREATEST(IFNULL(SUM(i.ingresotunel_total), 0) - o.orden_total_libras, 0) AS orden_libras_sobrantes
      FROM orden o
      LEFT JOIN talla t ON o.talla_id = t.talla_id
      LEFT JOIN peso p ON o.peso_id = p.peso_id
      LEFT JOIN glaseo g ON o.glaseo_id = g.glaseo_id
      LEFT JOIN ingresotunel i ON o.orden_id = i.orden_id
      WHERE o.talla_id = ?
      GROUP BY o.orden_id
      HAVING orden_libras_pendientes > 0
      ORDER BY o.orden_fecha_produccion ASC
      `,
      [tallaId]
    );

    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

// ==============================
// POST: Crear orden
// - orden_talla_marcada forzado
// - retorna la orden con JOINs
// ==============================
export const postOrden = async (req, res) => {
  try {
    const {
      orden_codigo,
      orden_descripcion,
      orden_cliente,
      orden_lote_cliente,
      orden_fecha_produccion,
      orden_fecha_juliana, // futura
      orden_talla_real,    // futura
      orden_microlote,
      orden_total_master,
      orden_total_libras,
      talla_id,
      peso_id,
      glaseo_id
    } = req.body;

    if (orden_total_libras == null || !talla_id)
      return res.status(400).json({ message: "orden_total_libras y talla_id requeridos" });

    const tallaId = Number(talla_id) || 0;
    if (tallaId <= 0) return res.status(400).json({ message: "talla_id inválido" });

    const tallaMarcada = await getTallaDescripcionById(tallaId);
    if (!tallaMarcada) return res.status(400).json({ message: "talla_id no existe" });

    const totalLibras = Number(orden_total_libras);
    if (isNaN(totalLibras) || totalLibras <= 0)
      return res.status(400).json({ message: "orden_total_libras requerido y mayor a 0" });

    const orden_libras_pendientes = totalLibras;
    const orden_libras_sobrantes = 0;
    const orden_estado = "pendiente";

    const [insert] = await conmysql.query(
      `INSERT INTO orden (
        orden_codigo, orden_descripcion, orden_cliente, orden_lote_cliente,
        orden_fecha_produccion, orden_fecha_juliana, orden_talla_real,
        orden_talla_marcada, orden_microlote, orden_total_master,
        orden_total_libras, orden_libras_pendientes, orden_libras_sobrantes,
        orden_estado, talla_id, peso_id, glaseo_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        orden_codigo || null,
        orden_descripcion || null,
        orden_cliente || null,
        orden_lote_cliente || null,
        orden_fecha_produccion || null,
        orden_fecha_juliana || null,
        orden_talla_real || null,
        tallaMarcada,
        orden_microlote || null,
        Number(orden_total_master) || 0,
        totalLibras,
        orden_libras_pendientes,
        orden_libras_sobrantes,
        orden_estado,
        tallaId,
        peso_id != null && peso_id !== "" ? Number(peso_id) : null,
        glaseo_id != null && glaseo_id !== "" ? Number(glaseo_id) : null
      ]
    );

    const nuevoId = insert.insertId;

    const [nuevo] = await conmysql.query(
      `
      SELECT 
        o.*,
        t.talla_descripcion,
        p.peso_descripcion,
        g.glaseo_cantidad,
        GREATEST(o.orden_total_libras - IFNULL(SUM(i.ingresotunel_total), 0), 0) AS orden_libras_pendientes,
        GREATEST(IFNULL(SUM(i.ingresotunel_total), 0) - o.orden_total_libras, 0) AS orden_libras_sobrantes
      FROM orden o
      LEFT JOIN talla t ON o.talla_id = t.talla_id
      LEFT JOIN peso p ON o.peso_id = p.peso_id
      LEFT JOIN glaseo g ON o.glaseo_id = g.glaseo_id
      LEFT JOIN ingresotunel i ON o.orden_id = i.orden_id
      WHERE o.orden_id = ?
      GROUP BY o.orden_id
      `,
      [nuevoId]
    );

    global._io.emit("orden_nueva", nuevo[0]);
    res.json(nuevo[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

// ==============================
// PUT: Actualizar orden
// - recalcula pendientes/sobrantes
// - orden_talla_marcada forzado
// - retorna con JOINs
// ==============================
export const putOrden = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      orden_codigo,
      orden_descripcion,
      orden_cliente,
      orden_lote_cliente,
      orden_fecha_produccion,
      orden_fecha_juliana,
      orden_talla_real,
      orden_microlote,
      orden_total_master,
      orden_total_libras,
      talla_id,
      peso_id,
      glaseo_id
    } = req.body;

    const totalMaster = Number(orden_total_master) || 0;
    const totalLibras = Number(orden_total_libras);
    const tallaId = Number(talla_id) || 0;

    if (isNaN(totalLibras) || totalLibras <= 0)
      return res.status(400).json({ message: "orden_total_libras requerido y mayor a 0" });

    if (tallaId <= 0)
      return res.status(400).json({ message: "talla_id requerido y mayor a 0" });

    const tallaMarcada = await getTallaDescripcionById(tallaId);
    if (!tallaMarcada) return res.status(400).json({ message: "talla_id no existe" });

    const fechaProduccion = orden_fecha_produccion || null;
    const fechaJuliana = orden_fecha_juliana || null;

    const [agg] = await conmysql.query(
      "SELECT IFNULL(SUM(ingresotunel_total), 0) AS empacadas FROM ingresotunel WHERE orden_id = ?",
      [id]
    );
    const empacadas = Number(agg[0].empacadas) || 0;

    if (totalLibras < empacadas) {
      return res.status(400).json({
        message: `No puedes establecer ${totalLibras} libras porque ya existen ${empacadas} libras ingresadas`
      });
    }

    let orden_libras_pendientes = totalLibras - empacadas;
    let orden_libras_sobrantes = 0;

    if (orden_libras_pendientes < 0) {
      orden_libras_sobrantes = Math.abs(orden_libras_pendientes);
      orden_libras_pendientes = 0;
    }

    const orden_estado = orden_libras_pendientes > 0 ? "pendiente" : "cumplida";

    const [update] = await conmysql.query(
      `UPDATE orden SET
         orden_codigo = ?,
         orden_descripcion = ?,
         orden_cliente = ?,
         orden_lote_cliente = ?,
         orden_fecha_produccion = ?,
         orden_fecha_juliana = ?,
         orden_talla_real = ?,
         orden_talla_marcada = ?,
         orden_microlote = ?,
         orden_total_master = ?,
         orden_total_libras = ?,
         orden_libras_pendientes = ?,
         orden_libras_sobrantes = ?,
         orden_estado = ?,
         talla_id = ?,
         peso_id = ?,
         glaseo_id = ?
       WHERE orden_id = ?`,
      [
        orden_codigo || null,
        orden_descripcion || null,
        orden_cliente || null,
        orden_lote_cliente || null,
        fechaProduccion,
        fechaJuliana,
        orden_talla_real || null,
        tallaMarcada,
        orden_microlote || null,
        totalMaster,
        totalLibras,
        orden_libras_pendientes,
        orden_libras_sobrantes,
        orden_estado,
        tallaId,
        peso_id != null && peso_id !== "" ? Number(peso_id) : null,
        glaseo_id != null && glaseo_id !== "" ? Number(glaseo_id) : null,
        id
      ]
    );

    if (!update.affectedRows)
      return res.status(404).json({ message: "Orden no encontrada" });

    const [actualizado] = await conmysql.query(
      `
      SELECT 
        o.*,
        t.talla_descripcion,
        p.peso_descripcion,
        g.glaseo_cantidad,
        GREATEST(o.orden_total_libras - IFNULL(SUM(i.ingresotunel_total), 0), 0) AS orden_libras_pendientes,
        GREATEST(IFNULL(SUM(i.ingresotunel_total), 0) - o.orden_total_libras, 0) AS orden_libras_sobrantes
      FROM orden o
      LEFT JOIN talla t ON o.talla_id = t.talla_id
      LEFT JOIN peso p ON o.peso_id = p.peso_id
      LEFT JOIN glaseo g ON o.glaseo_id = g.glaseo_id
      LEFT JOIN ingresotunel i ON o.orden_id = i.orden_id
      WHERE o.orden_id = ?
      GROUP BY o.orden_id
      `,
      [id]
    );

    global._io.emit("orden_actualizada", actualizado[0]);
    if (orden_estado === "cumplida") global._io.emit("orden_cumplida", actualizado[0]);

    res.json(actualizado[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

// DELETE
export const deleteOrden = async (req, res) => {
  try {
    const { id } = req.params;

    await conmysql.query("DELETE FROM orden WHERE orden_id = ?", [id]);

    global._io.emit("orden_eliminada", { orden_id: Number(id) });

    res.status(202).json({ message: "Orden eliminada con éxito" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
}; */

import { conmysql } from "../db.js";

/** Obtiene la descripción real de la talla según talla_id */
const getTallaDescripcionById = async (tallaId) => {
  const [rows] = await conmysql.query(
    "SELECT talla_descripcion FROM talla WHERE talla_id = ? LIMIT 1",
    [tallaId]
  );
  return rows.length ? rows[0].talla_descripcion : null;
};

const n = (v) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : NaN;
};

const isEmpty = (v) => v == null || String(v).trim() === "";

/** Reglas de "Otro" */
const PESO_OTRO_KG_ID = 8;
const PESO_OTRO_G_ID = 9;
const PESO_OTRO_LB_ID = 10;

const GLASEO_OTRO_ID = 10;

const KG_TO_LB = 2.2046;
const G_TO_LB_DIV = 453.59237;

/**
 * Normaliza “Otro Peso”:
 * - Kg (id=8) -> convierte a lb (para cálculos) y guarda texto "X Kg"
 * - g  (id=9) -> convierte a lb (para cálculos) y guarda texto "X g"
 * - lb (id=10)-> guarda directo y texto "X lb"
 */
function buildPesoOtro({ peso_id, peso_otro_valor }) {
  const pesoId = Number(peso_id);

  if (pesoId !== PESO_OTRO_KG_ID && pesoId !== PESO_OTRO_G_ID && pesoId !== PESO_OTRO_LB_ID) {
    return { orden_peso_otro: null, orden_peso_cantidad_otro: null };
  }

  const val = n(peso_otro_valor);
  if (!Number.isFinite(val) || val <= 0) {
    throw new Error("Peso 'Otro' inválido. Debe ser un número mayor a 0.");
  }

  // Kg -> lb
  if (pesoId === PESO_OTRO_KG_ID) {
    return {
      orden_peso_otro: `${val} Kg`,
      orden_peso_cantidad_otro: val * KG_TO_LB,
    };
  }

  // g -> lb
  if (pesoId === PESO_OTRO_G_ID) {
    return {
      orden_peso_otro: `${val} g`,
      orden_peso_cantidad_otro: val / G_TO_LB_DIV,
    };
  }

  // lb -> lb
  return {
    orden_peso_otro: `${val} lb`,
    orden_peso_cantidad_otro: val,
  };
}

/** Normaliza “Otro Glaseo”: agrega " ml" */
function buildGlaseoOtro({ glaseo_id, glaseo_otro_valor }) {
  const glaseoId = Number(glaseo_id);

  if (glaseoId !== GLASEO_OTRO_ID) {
    return { orden_glaseo_otro: null };
  }

  const val = n(glaseo_otro_valor);
  if (!Number.isFinite(val) || val <= 0) {
    throw new Error("Glaseo 'Otro' inválido. Debe ser un número mayor a 0.");
  }

  return { orden_glaseo_otro: `${val} ml` };
}

const selectOrdenBase = `
  SELECT 
    o.*,
    t.talla_descripcion,
    t.tipo_id AS talla_tipo_id,
    p.peso_descripcion,
    g.glaseo_cantidad,

    -- Textos finales a mostrar (custom si existe)
    COALESCE(NULLIF(o.orden_peso_otro, ''), p.peso_descripcion) AS peso_texto,
    COALESCE(NULLIF(o.orden_glaseo_otro, ''), g.glaseo_cantidad) AS glaseo_texto,

    GREATEST(o.orden_total_libras - IFNULL(SUM(i.ingresotunel_total), 0), 0) AS orden_libras_pendientes,
    GREATEST(IFNULL(SUM(i.ingresotunel_total), 0) - o.orden_total_libras, 0) AS orden_libras_sobrantes
  FROM orden o
  LEFT JOIN talla t ON o.talla_id = t.talla_id
  LEFT JOIN peso p ON o.peso_id = p.peso_id
  LEFT JOIN glaseo g ON o.glaseo_id = g.glaseo_id
  LEFT JOIN ingresotunel i ON o.orden_id = i.orden_id
`;

export const getOrden = async (req, res) => {
  try {
    const [result] = await conmysql.query(`
      ${selectOrdenBase}
      GROUP BY o.orden_id
      ORDER BY
        -- 1) Sobrantes primero, luego faltantes, luego “en 0”
        CASE
          WHEN orden_libras_sobrantes > 0 THEN 0
          WHEN orden_libras_pendientes > 0 THEN 1
          ELSE 2
        END,

        -- (Opcional) dentro del grupo: más sobrante / más pendiente arriba
        orden_libras_sobrantes DESC,
        orden_libras_pendientes DESC,

        -- 2) Talla: Entero (tipo_id=1) primero, luego Cola (tipo_id=2)
        CASE
          WHEN t.tipo_id = 1 THEN 0
          WHEN t.tipo_id = 2 THEN 1
          ELSE 2
        END,

        -- orden natural de talla
        t.talla_id ASC,

        -- fallback
        o.orden_fecha_produccion DESC
    `);

    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al consultar Órdenes" });
  }
};

export const getOrdenxid = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: "ID de orden inválido" });

    const [result] = await conmysql.query(
      `
      ${selectOrdenBase}
      WHERE o.orden_id = ?
      GROUP BY o.orden_id
      `,
      [id]
    );

    if (!result.length)
      return res.status(404).json({ orden_id: 0, message: "Orden no encontrada" });

    res.json(result[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error del Servidor" });
  }
};

export const getOrdenesPendientes = async (req, res) => {
  try {
    const tallaId = Number(req.query.talla_id);
    if (!tallaId) return res.status(400).json({ message: "talla_id required" });

    const [result] = await conmysql.query(
      `
      ${selectOrdenBase}
      WHERE o.talla_id = ?
      GROUP BY o.orden_id
      HAVING orden_libras_pendientes > 0
      ORDER BY o.orden_fecha_produccion ASC
      `,
      [tallaId]
    );

    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

export const postOrden = async (req, res) => {
  try {
    const {
      orden_codigo,
      orden_descripcion,
      orden_cliente,
      orden_lote_cliente,
      orden_fecha_produccion,
      orden_fecha_juliana, // futura
      orden_talla_real,    // futura
      orden_microlote,
      orden_total_master,
      orden_total_libras,
      talla_id,
      peso_id,
      glaseo_id,

      // inputs custom (vienen del front cuando selecciona "Otro")
      peso_otro_valor,
      glaseo_otro_valor
    } = req.body;

    if (isEmpty(orden_cliente)) return res.status(400).json({ message: "Cliente requerido" });
    if (isEmpty(orden_fecha_produccion)) return res.status(400).json({ message: "Fecha producción requerida" });

    const tallaId = Number(talla_id) || 0;
    if (tallaId <= 0) return res.status(400).json({ message: "talla_id inválido" });

    const tallaMarcada = await getTallaDescripcionById(tallaId);
    if (!tallaMarcada) return res.status(400).json({ message: "talla_id no existe" });

    const totalLibras = Number(orden_total_libras);
    if (!Number.isFinite(totalLibras) || totalLibras <= 0)
      return res.status(400).json({ message: "orden_total_libras requerido y mayor a 0" });

    const pesoId = Number(peso_id) || 0;
    const glaseoId = Number(glaseo_id) || 0;
    if (pesoId <= 0) return res.status(400).json({ message: "peso_id requerido" });
    if (glaseoId <= 0) return res.status(400).json({ message: "glaseo_id requerido" });

    // Construir custom si aplica
    let pesoOtro = { orden_peso_otro: null, orden_peso_cantidad_otro: null };
    let glaseoOtro = { orden_glaseo_otro: null };

    try {
      pesoOtro = buildPesoOtro({ peso_id: pesoId, peso_otro_valor });
      glaseoOtro = buildGlaseoOtro({ glaseo_id: glaseoId, glaseo_otro_valor });
    } catch (e) {
      return res.status(400).json({ message: e.message });
    }

    // Si NO es "Otro" pero mandan valor, lo ignoramos
    const orden_estado = "pendiente";
    const orden_libras_pendientes = totalLibras;
    const orden_libras_sobrantes = 0;

    const [insert] = await conmysql.query(
      `INSERT INTO orden (
        orden_codigo, orden_descripcion, orden_cliente, orden_lote_cliente,
        orden_fecha_produccion, orden_fecha_juliana, orden_talla_real,
        orden_talla_marcada, orden_microlote, orden_total_master,
        orden_total_libras, orden_libras_pendientes, orden_libras_sobrantes,
        orden_estado, talla_id, peso_id, glaseo_id,
        orden_peso_otro, orden_peso_cantidad_otro, orden_glaseo_otro
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        orden_codigo || null,
        orden_descripcion || null,
        orden_cliente || null,
        orden_lote_cliente || null,
        orden_fecha_produccion || null,
        orden_fecha_juliana || null,
        orden_talla_real || null,
        tallaMarcada,
        orden_microlote || null,
        Number(orden_total_master) || 0,
        totalLibras,
        orden_libras_pendientes,
        orden_libras_sobrantes,
        orden_estado,
        tallaId,
        pesoId,
        glaseoId,
        pesoOtro.orden_peso_otro,
        pesoOtro.orden_peso_cantidad_otro,
        glaseoOtro.orden_glaseo_otro
      ]
    );

    const nuevoId = insert.insertId;

    const [nuevo] = await conmysql.query(
      `
      ${selectOrdenBase}
      WHERE o.orden_id = ?
      GROUP BY o.orden_id
      `,
      [nuevoId]
    );

    global._io.emit("orden_nueva", nuevo[0]);
    res.json(nuevo[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

export const putOrden = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      orden_codigo,
      orden_descripcion,
      orden_cliente,
      orden_lote_cliente,
      orden_fecha_produccion,
      orden_fecha_juliana,
      orden_talla_real,
      orden_microlote,
      orden_total_master,
      orden_total_libras,
      talla_id,
      peso_id,
      glaseo_id,

      peso_otro_valor,
      glaseo_otro_valor
    } = req.body;

    const tallaId = Number(talla_id) || 0;
    if (tallaId <= 0) return res.status(400).json({ message: "talla_id requerido y mayor a 0" });

    const tallaMarcada = await getTallaDescripcionById(tallaId);
    if (!tallaMarcada) return res.status(400).json({ message: "talla_id no existe" });

    const totalLibras = Number(orden_total_libras);
    if (!Number.isFinite(totalLibras) || totalLibras <= 0)
      return res.status(400).json({ message: "orden_total_libras requerido y mayor a 0" });

    const pesoId = Number(peso_id) || 0;
    const glaseoId = Number(glaseo_id) || 0;
    if (pesoId <= 0) return res.status(400).json({ message: "peso_id requerido" });
    if (glaseoId <= 0) return res.status(400).json({ message: "glaseo_id requerido" });

    // libras empacadas
    const [agg] = await conmysql.query(
      "SELECT IFNULL(SUM(ingresotunel_total), 0) AS empacadas FROM ingresotunel WHERE orden_id = ?",
      [id]
    );
    const empacadas = Number(agg[0].empacadas) || 0;

    if (totalLibras < empacadas) {
      return res.status(400).json({
        message: `No puedes establecer ${totalLibras} libras porque ya existen ${empacadas} libras ingresadas`
      });
    }

    let orden_libras_pendientes = totalLibras - empacadas;
    let orden_libras_sobrantes = 0;

    if (orden_libras_pendientes < 0) {
      orden_libras_sobrantes = Math.abs(orden_libras_pendientes);
      orden_libras_pendientes = 0;
    }

    const orden_estado = orden_libras_pendientes > 0 ? "pendiente" : "cumplida";

    // custom si aplica
    let pesoOtro = { orden_peso_otro: null, orden_peso_cantidad_otro: null };
    let glaseoOtro = { orden_glaseo_otro: null };

    try {
      pesoOtro = buildPesoOtro({ peso_id: pesoId, peso_otro_valor });
      glaseoOtro = buildGlaseoOtro({ glaseo_id: glaseoId, glaseo_otro_valor });
    } catch (e) {
      return res.status(400).json({ message: e.message });
    }

    const [update] = await conmysql.query(
      `UPDATE orden SET
        orden_codigo = ?,
        orden_descripcion = ?,
        orden_cliente = ?,
        orden_lote_cliente = ?,
        orden_fecha_produccion = ?,
        orden_fecha_juliana = ?,
        orden_talla_real = ?,
        orden_talla_marcada = ?,
        orden_microlote = ?,
        orden_total_master = ?,
        orden_total_libras = ?,
        orden_libras_pendientes = ?,
        orden_libras_sobrantes = ?,
        orden_estado = ?,
        talla_id = ?,
        peso_id = ?,
        glaseo_id = ?,
        orden_peso_otro = ?,
        orden_peso_cantidad_otro = ?,
        orden_glaseo_otro = ?
      WHERE orden_id = ?`,
      [
        orden_codigo || null,
        orden_descripcion || null,
        orden_cliente || null,
        orden_lote_cliente || null,
        orden_fecha_produccion || null,
        orden_fecha_juliana || null,
        orden_talla_real || null,
        tallaMarcada,
        orden_microlote || null,
        Number(orden_total_master) || 0,
        totalLibras,
        orden_libras_pendientes,
        orden_libras_sobrantes,
        orden_estado,
        tallaId,
        pesoId,
        glaseoId,
        pesoOtro.orden_peso_otro,
        pesoOtro.orden_peso_cantidad_otro,
        glaseoOtro.orden_glaseo_otro,
        id
      ]
    );

    if (!update.affectedRows) return res.status(404).json({ message: "Orden no encontrada" });

    const [actualizado] = await conmysql.query(
      `
      ${selectOrdenBase}
      WHERE o.orden_id = ?
      GROUP BY o.orden_id
      `,
      [id]
    );

    global._io.emit("orden_actualizada", actualizado[0]);
    if (orden_estado === "cumplida") global._io.emit("orden_cumplida", actualizado[0]);

    res.json(actualizado[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

export const deleteOrden = async (req, res) => {
  try {
    const { id } = req.params;

    await conmysql.query("DELETE FROM orden WHERE orden_id = ?", [id]);

    global._io.emit("orden_eliminada", { orden_id: Number(id) });
    res.status(202).json({ message: "Orden eliminada con éxito" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};
