/* import { conmysql } from "../db.js";

//  GET /liquidacion?tipo=entero|cola
export const getLiquidaciones = async (req, res) => {
  try {
    const { tipo } = req.query;

    let tipoBD = "";
    if (tipo === "entero") tipoBD = "Camarón Entero";
    else if (tipo === "cola") tipoBD = "Camarón Cola";
    else return res.status(400).json({ message: "Tipo no válido" });

    const [filas] = await conmysql.query(`
      SELECT li.liquidacion_id,
             li.lote_id,
             lo.lote_codigo,
             li.liquidacion_tipo,
             li.liquidacion_rendimiento,
             li.liquidacion_basura,
             li.liquidacion_fecha
      FROM liquidacion li
      INNER JOIN lote lo ON lo.lote_id = li.lote_id
      WHERE li.liquidacion_tipo = ?
      ORDER BY li.liquidacion_id DESC
    `, [tipoBD]);

    return res.json(filas);

  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

//  GET /liquidacion/:id
export const getLiquidacionxid = async (req, res) => {
  try {
    const { id } = req.params;

    const [cab] = await conmysql.query(`
      SELECT li.liquidacion_id,
             li.lote_id,
             lo.lote_codigo,
             li.liquidacion_tipo,
             li.liquidacion_rendimiento,
             li.liquidacion_basura,
             li.liquidacion_fecha
      FROM liquidacion li
      INNER JOIN lote lo ON lo.lote_id = li.lote_id
      WHERE li.liquidacion_id = ?
    `, [id]);

    if (!cab.length)
      return res.status(404).json({ message: "Liquidación no encontrada" });

    const [det] = await conmysql.query(`
      SELECT talla, clase, color, corte, peso, presentacion, orden,
             libras, coches
      FROM liquidacion_detalle
      WHERE liquidacion_id = ?
    `, [id]);

    return res.json({
      cabecera: cab[0],
      detalles: det
    });

  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

//  POST /liquidacion  (GENERAR LIQUIDACIÓN)
export const postLiquidacion = async (req, res) => {
  try {
    const { lote_id, tipo } = req.body;

    if (!lote_id || !tipo)
      return res.status(400).json({ message: "Datos incompletos" });

    let tipo_id = 0;
    let tipoBD = "";

    if (tipo === "entero") { tipo_id = 1; tipoBD = "Camarón Entero"; }
    else if (tipo === "cola") { tipo_id = 2; tipoBD = "Camarón Cola"; }
    else return res.status(400).json({ message: "Tipo no válido" });

    // --------- AUTOCORREGIR tipo_id en ingresos ----------------
    await conmysql.query(`
      UPDATE ingresotunel SET tipo_id = ?
      WHERE lote_id = ? AND (tipo_id = 0 OR tipo_id IS NULL)
    `, [tipo_id, lote_id]);

    // --------- CARGAR INGRESOS ----------------
    const [ingresos] = await conmysql.query(`
      SELECT it.*, 
             t.talla_descripcion, c.clase_descripcion, col.color_descripcion,
             co.corte_descripcion, p.peso_descripcion, g.glaseo_cantidad,
             pr.presentacion_descripcion, o.orden_codigo
      FROM ingresotunel it
      LEFT JOIN talla t ON it.talla_id = t.talla_id
      LEFT JOIN clase c ON it.clase_id = c.clase_id
      LEFT JOIN color col ON it.color_id = col.color_id
      LEFT JOIN corte co ON it.corte_id = co.corte_id
      LEFT JOIN peso p ON it.peso_id = p.peso_id
      LEFT JOIN glaseo g ON it.glaseo_id = g.glaseo_id
      LEFT JOIN presentacion pr ON it.presentacion_id = pr.presentacion_id
      LEFT JOIN orden o ON it.orden_id = o.orden_id
      WHERE it.lote_id = ? AND it.tipo_id = ?
    `, [lote_id, tipo_id]);

    if (!ingresos.length)
      return res.status(400).json({ message: "No existen ingresos para este tipo" });

    // --------- DETECTAR INCONSISTENCIAS ----------------
    const inconsistencias = {};
    const mapa = {};

    ingresos.forEach(i => {
      const clave = `${i.talla_id}-${i.clase_id}-${i.color_id}-${i.corte_id}-${i.presentacion_id}-${i.glaseo_id}-${i.orden_id}`;
      if (!mapa[clave]) mapa[clave] = { pesos: new Set(), ingresos: [] };
      mapa[clave].pesos.add(i.peso_id);
      mapa[clave].ingresos.push(i);
    });

    for (let k of Object.keys(mapa)) {
      if (mapa[k].pesos.size > 1)
        inconsistencias[k] = "Variación de peso detectada";
    }

    // --------- ELIMINAR LIQUIDACIÓN PREVIA SI EXISTE ----------------
    const [exist] = await conmysql.query(`
      SELECT liquidacion_id FROM liquidacion
      WHERE lote_id = ? AND liquidacion_tipo = ?
    `, [lote_id, tipoBD]);

    if (exist.length > 0) {
      const old = exist[0].liquidacion_id;
      await conmysql.query(`DELETE FROM liquidacion_detalle WHERE liquidacion_id = ?`, [old]);
      await conmysql.query(`DELETE FROM liquidacion WHERE liquidacion_id = ?`, [old]);
    }

    // --------- CALCULOS ----------------
    const totalLibras = ingresos.reduce((s, x) => s + Number(x.ingresotunel_total), 0);
    const totalBasura = ingresos.reduce((s, x) => s + Number(x.ingresotunel_basura || 0), 0);
    const rendimiento = totalLibras + totalBasura > 0
      ? (totalLibras / (totalLibras + totalBasura)) * 100
      : 0;

    // --------- INSERT CABECERA ----------------
    const [liq] = await conmysql.query(`
      INSERT INTO liquidacion 
      (lote_id, liquidacion_tipo, liquidacion_rendimiento, liquidacion_basura)
      VALUES (?, ?, ?, ?)
    `, [lote_id, tipoBD, rendimiento, totalBasura]);

    const liquidacion_id = liq.insertId;

    // --------- INSERT DETALLES ----------------
    const detalleMap = {};

    ingresos.forEach(i => {
      const clave = `${i.talla_descripcion}-${i.clase_descripcion}-${i.color_descripcion}-${i.corte_descripcion}-${i.peso_descripcion}-${i.glaseo_cantidad}-${i.presentacion_descripcion}-${i.orden_codigo}`;

      if (!detalleMap[clave]) {
        detalleMap[clave] = {
          talla: i.talla_descripcion,
          clase: i.clase_descripcion,
          color: i.color_descripcion,
          corte: i.corte_descripcion,
          peso: i.peso_descripcion,
          glaseo: i.glaseo_cantidad,
          presentacion: i.presentacion_descripcion,
          orden: i.orden_codigo,
          libras: 0,
          coches: 0
        };
      }

      detalleMap[clave].libras += Number(i.ingresotunel_total);
      detalleMap[clave].coches++;
    });

    for (let d of Object.values(detalleMap)) {
      await conmysql.query(`
        INSERT INTO liquidacion_detalle
        (liquidacion_id, talla, clase, color, corte, peso, glaseo,
         presentacion, orden, libras, coches)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        liquidacion_id,
        d.talla, d.clase, d.color, d.corte,
        d.peso, d.glaseo, d.presentacion, d.orden,
        d.libras, d.coches
      ]);
    }

    return res.json({ message: "Liquidación generada", liquidacion_id, inconsistencias });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: err.message });
  }
};
 */



// src/controladores/liquidacionCtrl.js
import { conmysql } from "../db.js";

// =========================================================
//  GET /liquidacion?tipo=entero|cola   (LISTAR LIQUIDACIONES)
// =========================================================
export const getLiquidaciones = async (req, res) => {
  try {
    const { tipo } = req.query;

    let tipoBD = "";
    if (tipo === "entero") tipoBD = "Camarón Entero";
    else if (tipo === "cola") tipoBD = "Camarón Cola";
    else return res.status(400).json({ message: "Tipo no válido" });

    const [filas] = await conmysql.query(`
      SELECT 
        li.liquidacion_id,
        li.lote_id,
        lo.lote_codigo,
        lo.lote_libras_remitidas,
        lo.lote_n_bines,
        li.liquidacion_tipo,
        li.liquidacion_rendimiento,
        li.liquidacion_basura,
        li.liquidacion_total_libras,
        li.liquidacion_sobrante,
        li.liquidacion_fecha
      FROM liquidacion li
      INNER JOIN lote lo ON lo.lote_id = li.lote_id
      WHERE li.liquidacion_tipo = ?
      ORDER BY li.liquidacion_id DESC
    `, [tipoBD]);

    return res.json(filas);

  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: err.message });
  }
};

// =========================================================
//  GET /liquidacion/:id   (DETALLE COMPLETO)
// =========================================================
export const getLiquidacionxid = async (req, res) => {
  try {
    const { id } = req.params;

    // CABECERA + DATOS DE LOTE/PROVEEDOR/PISCINA
    const [cab] = await conmysql.query(`
      SELECT 
        li.liquidacion_id,
        li.lote_id,
        lo.lote_codigo,
        li.liquidacion_tipo,
        li.liquidacion_rendimiento,
        li.liquidacion_basura,
        li.liquidacion_total_libras,
        li.liquidacion_sobrante,
        li.liquidacion_fecha,
        lo.lote_libras_remitidas,
        lo.lote_n_bines,
        pr.proveedor_nombre,
        pi.piscina_nombre,
        CASE 
          WHEN lo.lote_libras_remitidas > 0 
          THEN (li.liquidacion_total_libras / lo.lote_libras_remitidas)
          ELSE 0 
        END AS peso_promedio
      FROM liquidacion li
      INNER JOIN lote lo     ON lo.lote_id      = li.lote_id
      LEFT JOIN proveedor pr ON pr.proveedor_id = lo.proveedor_id
      LEFT JOIN piscina  pi  ON pi.piscina_id   = lo.piscina_id
      WHERE li.liquidacion_id = ?
    `, [id]);

    if (!cab.length)
      return res.status(404).json({ message: "Liquidación no encontrada" });

    // DETALLE (YA TRAE ORDEN)
    const [det] = await conmysql.query(`
      SELECT 
        talla, clase, color, corte, peso, presentacion, orden,
        libras, coches
      FROM liquidacion_detalle
      WHERE liquidacion_id = ?
    `, [id]);

    return res.json({
      cabecera: cab[0],
      detalles: det
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: err.message });
  }
};

// =========================================================
//  POST /liquidacion   (GENERAR LIQUIDACIÓN)
// =========================================================
export const postLiquidacion = async (req, res) => {
  try {
    const { lote_id, tipo } = req.body;

    if (!lote_id || !tipo)
      return res.status(400).json({ message: "Datos incompletos" });

    // MAPEO TIPO
    let tipo_id = 0;
    let tipoBD = "";

    if (tipo === "entero") {
      tipo_id = 1;
      tipoBD = "Camarón Entero";
    } else if (tipo === "cola") {
      tipo_id = 2;
      tipoBD = "Camarón Cola";
    } else {
      return res.status(400).json({ message: "Tipo no válido" });
    }

    // AUTOCORREGIR tipo_id EN INGRESOS
    await conmysql.query(
      `UPDATE ingresotunel
       SET tipo_id = ?
       WHERE lote_id = ? AND (tipo_id = 0 OR tipo_id IS NULL)`,
      [tipo_id, lote_id]
    );

    // CARGAR INGRESOS DEL TÚNEL
    const [ingresos] = await conmysql.query(`
      SELECT it.*, 
             t.talla_descripcion,
             c.clase_descripcion,
             col.color_descripcion,
             co.corte_descripcion,
             p.peso_descripcion,
             g.glaseo_cantidad,
             pr.presentacion_descripcion,
             o.orden_codigo
      FROM ingresotunel it
      LEFT JOIN talla t ON it.talla_id = t.talla_id
      LEFT JOIN clase c ON it.clase_id = c.clase_id
      LEFT JOIN color col ON it.color_id = col.color_id
      LEFT JOIN corte co ON it.corte_id = co.corte_id
      LEFT JOIN peso p ON it.peso_id = p.peso_id
      LEFT JOIN glaseo g ON it.glaseo_id = g.glaseo_id
      LEFT JOIN presentacion pr ON it.presentacion_id = pr.presentacion_id
      LEFT JOIN orden o ON it.orden_id = o.orden_id
      WHERE it.lote_id = ? AND it.tipo_id = ?
    `, [lote_id, tipo_id]);

    if (!ingresos.length)
      return res.status(400).json({ message: "No existen ingresos para este tipo" });

    // LEER DATOS DEL LOTE PARA LIBRAS REMITIDAS Y BINES
    const [lotes] = await conmysql.query(`
      SELECT lote_libras_remitidas, lote_n_bines
      FROM lote
      WHERE lote_id = ?
    `, [lote_id]);

    const lote = lotes[0] || { lote_libras_remitidas: 0, lote_n_bines: 0 };
    const librasRemitidas = Number(lote.lote_libras_remitidas || 0);

    // DETECTAR INCONSISTENCIAS
    const inconsistencias = {};
    const mapa = {};

    ingresos.forEach(i => {
      const clave = `${i.talla_id}-${i.clase_id}-${i.color_id}-${i.corte_id}-${i.presentacion_id}-${i.glaseo_id}-${i.orden_id}`;

      if (!mapa[clave])
        mapa[clave] = { pesos: new Set(), ingresos: [] };

      mapa[clave].pesos.add(i.peso_id);
      mapa[clave].ingresos.push(i);
    });

    for (let k of Object.keys(mapa)) {
      if (mapa[k].pesos.size > 1)
        inconsistencias[k] = "Variación de peso detectada";
    }

    // ELIMINAR LIQUIDACIÓN PREVIA SI EXISTE
    const [exist] = await conmysql.query(`
      SELECT liquidacion_id
      FROM liquidacion
      WHERE lote_id = ? AND liquidacion_tipo = ?
    `, [lote_id, tipoBD]);

    if (exist.length > 0) {
      const old = exist[0].liquidacion_id;
      await conmysql.query(`DELETE FROM liquidacion_detalle WHERE liquidacion_id = ?`, [old]);
      await conmysql.query(`DELETE FROM liquidacion WHERE liquidacion_id = ?`, [old]);
    }

    // CÁLCULOS
    const totalLibras = ingresos.reduce((s, x) => s + Number(x.ingresotunel_total), 0);
    const totalBasura = ingresos.reduce((s, x) => s + Number(x.ingresotunel_basura || 0), 0);

    // Sobrante = libras remitidas - empacado - basura (no bajamos de 0)
    let sobrante = 0;
    if (librasRemitidas > 0) {
      sobrante = librasRemitidas - totalLibras - totalBasura;
      if (sobrante < 0) sobrante = 0;
    }

    // Rendimiento según la lógica que definiste:
    // Rendimiento (%) = (Total Empacado / Libras Remitidas) * 100
    const rendimiento =
      librasRemitidas > 0
        ? (totalLibras / librasRemitidas) * 100
        : 0;

    // INSERT CABECERA
    const [liq] = await conmysql.query(`
      INSERT INTO liquidacion 
      (lote_id, liquidacion_tipo, liquidacion_rendimiento, liquidacion_basura,
       liquidacion_total_libras, liquidacion_sobrante)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [lote_id, tipoBD, rendimiento, totalBasura, totalLibras, sobrante]);

    const liquidacion_id = liq.insertId;

    // INSERT DETALLES AGRUPADOS
    const detalleMap = {};

    ingresos.forEach(i => {
      const clave = `${i.talla_descripcion}-${i.clase_descripcion}-${i.color_descripcion}-${i.corte_descripcion}-${i.peso_descripcion}-${i.glaseo_cantidad}-${i.presentacion_descripcion}-${i.orden_codigo}`;

      if (!detalleMap[clave]) {
        detalleMap[clave] = {
          talla: i.talla_descripcion,
          clase: i.clase_descripcion,
          color: i.color_descripcion,
          corte: i.corte_descripcion,
          peso: i.peso_descripcion,
          glaseo: i.glaseo_cantidad,
          presentacion: i.presentacion_descripcion,
          orden: i.orden_codigo,
          libras: 0,
          coches: 0
        };
      }

      detalleMap[clave].libras += Number(i.ingresotunel_total);
      detalleMap[clave].coches++;
    });

    for (let d of Object.values(detalleMap)) {
      await conmysql.query(`
        INSERT INTO liquidacion_detalle
        (liquidacion_id, talla, clase, color, corte, peso, glaseo,
         presentacion, orden, libras, coches)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        liquidacion_id,
        d.talla, d.clase, d.color, d.corte,
        d.peso, d.glaseo, d.presentacion, d.orden,
        d.libras, d.coches
      ]);
    }

    return res.json({
      message: "Liquidación generada",
      liquidacion_id,
      inconsistencias
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: err.message });
  }
};
