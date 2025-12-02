import { conmysql } from "../db.js";

// =========================================================
//  GET /trazabilidad/:lote_id
//  Devuelve TODO EL HISTORIAL DEL LOTE
// =========================================================
export const getHistorialLote = async (req, res) => {
  try {
    const { lote_id } = req.params;

    // ------------------------------
    // 1️⃣ RECEPCIÓN (LOTE)
    // ------------------------------
    const [recepcion] = await conmysql.query(`
      SELECT 
        l.lote_id,
        l.lote_codigo,
        l.lote_libras_remitidas,
        l.lote_n_bines,
        l.lote_n_piscina,
        pr.proveedor_nombre,
        l.lote_fecha
      FROM lote l
      LEFT JOIN proveedor pr ON pr.proveedor_id = l.proveedor_id
      WHERE l.lote_id = ?`, [lote_id]);

    if (!recepcion.length)
      return res.status(404).json({ message: "Lote no encontrado" });

    // ------------------------------
    // 2️⃣ CALIDAD
    // ------------------------------
    const [calidad] = await conmysql.query(`
      SELECT * FROM defectos 
      WHERE lote_id = ?
    `, [lote_id]);

    // ------------------------------
    // 3️⃣ CLASIFICACIÓN (detalle)
    // ------------------------------
    const [clasificacion] = await conmysql.query(`
      SELECT * FROM clasificacion 
      WHERE lote_id = ?
    `, [lote_id]);

    // ------------------------------
    // 4️⃣ DESCABEZADO
    // ------------------------------
    const [descabezado] = await conmysql.query(`
      SELECT * FROM descabezado
      WHERE lote_id = ?
    `, [lote_id]);

    // ------------------------------
    // 5️⃣ PELADO
    // ------------------------------
    const [pelado] = await conmysql.query(`
      SELECT * FROM pelado
      WHERE lote_id = ?
    `, [lote_id]);

    // ------------------------------
    // 6️⃣ INGRESO TÚNEL (detalle)
    // ------------------------------
    const [ingresos] = await conmysql.query(`
      SELECT 
        it.*, 
        t.talla_descripcion AS talla,
        c.clase_descripcion AS clase,
        col.color_descripcion AS color,
        co.corte_descripcion AS corte,
        p.peso_descripcion AS peso,
        pr.presentacion_descripcion AS presentacion,
        g.glaseo_cantidad AS glaseo
      FROM ingresotunel it
      LEFT JOIN talla t ON it.talla_id = t.talla_id
      LEFT JOIN clase c ON it.clase_id = c.clase_id
      LEFT JOIN color col ON it.color_id = col.color_id
      LEFT JOIN corte co ON it.corte_id = co.corte_id
      LEFT JOIN peso p ON it.peso_id = p.peso_id
      LEFT JOIN glaseo g ON it.glaseo_id = g.glaseo_id
      LEFT JOIN presentacion pr ON it.presentacion_id = pr.presentacion_id
      WHERE it.lote_id = ?
    `, [lote_id]);

    // ------------------------------
    // 7️⃣ MASTERIZADO
    // ------------------------------
    const [masterizado] = await conmysql.query(`
      SELECT * FROM masterizado
      WHERE lote_id = ?
    `, [lote_id]);

    // ------------------------------
    // 8️⃣ LIQUIDACIÓN ENTERO
    // ------------------------------
    const [liqEntero] = await conmysql.query(`
      SELECT * FROM liquidacion
      WHERE lote_id = ? AND liquidacion_tipo = 'Camarón Entero'
    `, [lote_id]);

    // ------------------------------
    // 9️⃣ LIQUIDACIÓN COLA
    // ------------------------------
    const [liqCola] = await conmysql.query(`
      SELECT * FROM liquidacion
      WHERE lote_id = ? AND liquidacion_tipo = 'Camarón Cola'
    `, [lote_id]);

    return res.json({
      recepcion: recepcion[0],
      calidad,
      clasificacion,
      descabezado,
      pelado,
      ingresos_tunel: ingresos,
      masterizado,
      liquidacion_entero: liqEntero[0] || null,
      liquidacion_cola: liqCola[0] || null,
    });

  } catch (err) {
    console.error("Error Trazabilidad:", err);
    return res.status(500).json({ message: err.message });
  }
};
