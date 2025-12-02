/* // src/controladores/liquidacionCtrl.js
import { conmysql } from "../db.js";

// =========================================================
//  GET /liquidacion?tipo=entero|cola
//  Lista de cabeceras de liquidaciones por tipo
// =========================================================
export const getLiquidaciones = async (req, res) => {
  try {
    const { tipo } = req.query;

    let tipoBD = "";
    if (tipo === "entero") tipoBD = "Camarón Entero";
    else if (tipo === "cola") tipoBD = "Camarón Cola";
    else return res.status(400).json({ message: "Tipo no válido" });

    const [filas] = await conmysql.query(
      `
      SELECT 
        li.liquidacion_id,
        li.lote_id,
        lo.lote_codigo,
        lo.lote_libras_remitidas,
        lo.lote_n_bines,
        li.liquidacion_tipo,
        li.liquidacion_rendimiento,
        li.liquidacion_basura,
        li.liquidacion_sobrante,
        li.liquidacion_total_libras AS total_libras,
        li.liquidacion_fecha
      FROM liquidacion li
      INNER JOIN lote lo ON lo.lote_id = li.lote_id
      WHERE li.liquidacion_tipo = ?
      ORDER BY li.liquidacion_id DESC
      `,
      [tipoBD]
    );

    return res.json(filas);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: err.message });
  }
};

// =========================================================
//  GET /liquidacion/:id
//  Cabecera + Detalle agrupado (Clase, Talla, Orden, Glaseo...)
// =========================================================
export const getLiquidacionxid = async (req, res) => {
  try {
    const { id } = req.params;

    const [cab] = await conmysql.query(
      `
      SELECT 
        li.liquidacion_id,
        li.lote_id,
        lo.lote_codigo,
        li.liquidacion_tipo,
        li.liquidacion_rendimiento,
        li.liquidacion_basura,
        li.liquidacion_sobrante,
        li.liquidacion_total_libras AS total_libras,
        li.liquidacion_fecha,
        lo.lote_libras_remitidas,
        lo.lote_n_bines,
        pr.proveedor_nombre,
        lo.lote_n_piscina,
        CASE 
          WHEN lo.lote_n_bines > 0 
          THEN lo.lote_libras_remitidas / lo.lote_n_bines
          ELSE 0 
        END AS peso_promedio
      FROM liquidacion li
      INNER JOIN lote lo     ON lo.lote_id      = li.lote_id
      LEFT JOIN proveedor pr ON pr.proveedor_id = lo.proveedor_id
      WHERE li.liquidacion_id = ?
      `,
      [id]
    );

    if (!cab.length) {
      return res.status(404).json({ message: "Liquidación no encontrada" });
    }

    const [det] = await conmysql.query(
      `
      SELECT 
        talla,
        clase,
        orden,
        glaseo,
        color,
        corte,
        presentacion,
        peso,
        cajas,
        coches,
        libras
      FROM liquidacion_detalle
      WHERE liquidacion_id = ?
      ORDER BY clase, talla, orden, glaseo, color, corte, presentacion, peso
      `,
      [id]
    );

    return res.json({
      cabecera: cab[0],
      detalles: det,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: err.message });
  }
};

// =========================================================
//  POST /liquidacion
//  Genera liquidación agrupando ingresos de túnel (por tipo)
// =========================================================
export const postLiquidacion = async (req, res) => {
  try {
    const { lote_id, tipo } = req.body;

    if (!lote_id || !tipo) {
      return res.status(400).json({ message: "Datos incompletos" });
    }

    // MAPEO TIPO
    const tipoBD =
      tipo === "entero"
        ? "Camarón Entero"
        : tipo === "cola"
        ? "Camarón Cola"
        : null;

    if (!tipoBD) {
      return res.status(400).json({ message: "Tipo no válido" });
    }

    // tipo_id en ingresotunel:
    // entero -> 1  |  cola -> 2
    const tipo_id = tipo === "entero" ? 1 : 2;

    // AUTOCORRECCIÓN de tipo en ingresotunel si viene en 0/null
    await conmysql.query(
      `
      UPDATE ingresotunel
      SET tipo_id = ?
      WHERE lote_id = ? AND (tipo_id = 0 OR tipo_id IS NULL)
      `,
      [tipo_id, lote_id]
    );

    // CARGAR INGRESOS del lote/tipo
    const [ingresos] = await conmysql.query(
      `
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
      LEFT JOIN talla        t   ON it.talla_id        = t.talla_id
      LEFT JOIN clase        c   ON it.clase_id        = c.clase_id
      LEFT JOIN color        col ON it.color_id        = col.color_id
      LEFT JOIN corte        co  ON it.corte_id        = co.corte_id
      LEFT JOIN peso         p   ON it.peso_id         = p.peso_id
      LEFT JOIN glaseo       g   ON it.glaseo_id       = g.glaseo_id
      LEFT JOIN presentacion pr  ON it.presentacion_id = pr.presentacion_id
      LEFT JOIN orden        o   ON it.orden_id        = o.orden_id
      WHERE it.lote_id = ? AND it.tipo_id = ?
      `,
      [lote_id, tipo_id]
    );

    if (!ingresos.length) {
      return res
        .status(400)
        .json({ message: "No existen ingresos para este tipo" });
    }

    // DATOS DEL LOTE
    const [lotes] = await conmysql.query(
      `SELECT lote_libras_remitidas, lote_n_bines FROM lote WHERE lote_id = ?`,
      [lote_id]
    );

    const lote = lotes[0] || {};
    const librasRemitidas = Number(lote.lote_libras_remitidas || 0);

    // INCONSISTENCIAS (variación de peso dentro del mismo combo T/C/...)
    const inconsistencias = {};
    const mapa = {};

    ingresos.forEach((i) => {
      const clave = `${i.talla_id}-${i.clase_id}-${i.color_id}-${i.corte_id}-${i.presentacion_id}-${i.glaseo_id}-${i.orden_id}`;
      if (!mapa[clave]) mapa[clave] = { pesos: new Set() };
      mapa[clave].pesos.add(i.peso_id);
    });

    for (const k in mapa) {
      if (mapa[k].pesos.size > 1)
        inconsistencias[k] = "Variación de peso detectada";
    }

    // ELIMINAR LIQUIDACIÓN PREVIA (del mismo lote/tipo)
    const [exist] = await conmysql.query(
      `SELECT liquidacion_id FROM liquidacion WHERE lote_id = ? AND liquidacion_tipo = ?`,
      [lote_id, tipoBD]
    );

    if (exist.length > 0) {
      const old = exist[0].liquidacion_id;
      await conmysql.query(
        `DELETE FROM liquidacion_detalle WHERE liquidacion_id = ?`,
        [old]
      );
      await conmysql.query(
        `DELETE FROM liquidacion WHERE liquidacion_id = ?`,
        [old]
      );
    }

    // CÁLCULOS BASE
    const totalLibras = ingresos.reduce(
      (s, x) => s + Number(x.ingresotunel_total || 0),
      0
    );
    const totalBasura = ingresos.reduce(
      (s, x) => s + Number(x.ingresotunel_basura || 0),
      0
    );

    // SOBRANTE REAL
    let sobrante = 0;
    if (librasRemitidas > 0) {
      sobrante = librasRemitidas - totalLibras - totalBasura;
      if (sobrante < 0) sobrante = 0;
    }

    // RENDIMIENTO REAL (solo en base a lo empacado vs empacado+basura)
    const rendimiento =
      totalLibras + totalBasura > 0
        ? (totalLibras / (totalLibras + totalBasura)) * 100
        : 0;

    // INSERT CABECERA
    const [liq] = await conmysql.query(
      `
      INSERT INTO liquidacion 
      (lote_id, liquidacion_tipo, liquidacion_rendimiento, liquidacion_basura,
       liquidacion_total_libras, liquidacion_sobrante)
      VALUES (?, ?, ?, ?, ?, ?)
      `,
      [lote_id, tipoBD, rendimiento, totalBasura, totalLibras, sobrante]
    );

    const liquidacion_id = liq.insertId;

    // DETALLES AGRUPADOS
    const detalleMap = {};

    ingresos.forEach((i) => {
      const key = `${i.clase_descripcion}-${i.talla_descripcion}-${i.orden_codigo}-${i.glaseo_cantidad}-${i.color_descripcion}-${i.corte_descripcion}-${i.presentacion_descripcion}-${i.peso_descripcion}`;

      if (!detalleMap[key]) {
        detalleMap[key] = {
          clase: i.clase_descripcion || "-",
          talla: i.talla_descripcion || "-",
          orden: i.orden_codigo || "-",
          glaseo: i.glaseo_cantidad ?? "-",
          color: i.color_descripcion || "-",
          corte: i.corte_descripcion || "-",
          presentacion: i.presentacion_descripcion || "-",
          peso: i.peso_descripcion || "-",
          coches: 0,
          cajas: 0,
          libras: 0,
        };
      }

      detalleMap[key].coches += 1;
      detalleMap[key].cajas += Number(i.ingresotunel_n_cajas || 0);
      detalleMap[key].libras += Number(i.ingresotunel_total || 0);
    });

    for (const d of Object.values(detalleMap)) {
      const det = d; // Revisar xd
      await conmysql.query(
        `
        INSERT INTO liquidacion_detalle
        (liquidacion_id, talla, clase, orden, glaseo, color, corte, presentacion,
         peso, cajas, coches, libras)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          liquidacion_id,
          det.talla,
          det.clase,
          det.orden,
          det.glaseo,
          det.color,
          det.corte,
          det.presentacion,
          det.peso,
          det.cajas,
          det.coches,
          det.libras,
        ]
      );
    }

    return res.json({
      message: "Liquidación generada correctamente",
      liquidacion_id,
      inconsistencias,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: err.message });
  }
};
 */


import { conmysql } from "../db.js";

const mapTipoBD = (tipo) => {
  switch (tipo) {
    case "entero":
      return { tipoBD: "Camarón Entero", tipoId: 1 };
    case "cola":
      return { tipoBD: "Camarón Cola", tipoId: 2 };
    default:
      return null;
  }
};

// ===========================================================
// LISTAR LIQUIDACIONES
// ===========================================================
export const getLiquidaciones = async (req, res) => {
  try {
    const { tipo } = req.query;
    const map = mapTipoBD(tipo);
    if (!map) return res.status(400).json({ message: "Tipo no válido" });

    const [filas] = await conmysql.query(
      `
      SELECT 
        li.liquidacion_id,
        li.lote_id,
        lo.lote_codigo,
        lo.lote_libras_remitidas,
        lo.lote_n_bines,
        li.liquidacion_tipo,
        li.liquidacion_rendimiento,
        li.liquidacion_basura,
        li.liquidacion_sobrante,
        li.liquidacion_total_libras AS total_libras,
        li.total_cajas,
        li.liquidacion_fecha
      FROM liquidacion li
      INNER JOIN lote lo ON lo.lote_id = li.lote_id
      WHERE li.liquidacion_tipo = ?
      ORDER BY li.liquidacion_id DESC
    `,
      [map.tipoBD]
    );

    res.json(filas);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

// ===========================================================
// DETALLE
// ===========================================================
export const getLiquidacionxid = async (req, res) => {
  try {
    const { id } = req.params;

    const [cab] = await conmysql.query(
      `
      SELECT 
        li.*, 
        lo.lote_codigo,
        lo.lote_libras_remitidas,
        lo.lote_n_bines,
        lo.lote_n_piscina,
        pr.proveedor_nombre,
        CASE WHEN lo.lote_n_bines > 0 
             THEN lo.lote_libras_remitidas / lo.lote_n_bines
             ELSE 0 END AS peso_promedio
      FROM liquidacion li
      INNER JOIN lote lo ON lo.lote_id = li.lote_id
      LEFT JOIN proveedor pr ON pr.proveedor_id = lo.proveedor_id
      WHERE li.liquidacion_id = ?
    `,
      [id]
    );

    if (!cab.length)
      return res.status(404).json({ message: "No encontrada" });

    const [det] = await conmysql.query(
      `
        SELECT talla, clase, color, corte, peso, glaseo, presentacion,
               orden, cajas, coches, libras
        FROM liquidacion_detalle
        WHERE liquidacion_id = ?
        ORDER BY clase, talla, orden, glaseo, color, corte, presentacion, peso
      `,
      [id]
    );

    res.json({ cabecera: cab[0], detalles: det });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ===========================================================
// CREAR LIQUIDACIÓN
// ===========================================================
export const postLiquidacion = async (req, res) => {
  try {
    const { lote_id, tipo } = req.body;

    const map = mapTipoBD(tipo);
    if (!map) return res.status(400).json({ message: "Tipo inválido" });

    await conmysql.query(
      `UPDATE ingresotunel SET tipo_id=? WHERE lote_id=? AND (tipo_id=0 OR tipo_id IS NULL)`,
      [map.tipoId, lote_id]
    );

    const [ing] = await conmysql.query(
      `
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
      LEFT JOIN talla t ON it.talla_id=t.talla_id
      LEFT JOIN clase c ON it.clase_id=c.clase_id
      LEFT JOIN color col ON it.color_id=col.color_id
      LEFT JOIN corte co ON it.corte_id=co.corte_id
      LEFT JOIN peso p ON it.peso_id=p.peso_id
      LEFT JOIN glaseo g ON it.glaseo_id=g.glaseo_id
      LEFT JOIN presentacion pr ON it.presentacion_id=pr.presentacion_id
      LEFT JOIN orden o ON it.orden_id=o.orden_id
      WHERE it.lote_id=? AND it.tipo_id=?
    `,
      [lote_id, map.tipoId]
    );

    if (!ing.length)
      return res.status(400).json({ message: "No ingresos" });

    // LOTES
    const [[lot]] = await conmysql.query(
      `SELECT lote_libras_remitidas FROM lote WHERE lote_id=?`,
      [lote_id]
    );

    const remitidas = Number(lot.lote_libras_remitidas);

    // SUMAS
    const totalLibras = ing.reduce((s, x) => s + Number(x.ingresotunel_total || 0), 0);
    const totalBasura = ing.reduce((s, x) => s + Number(x.ingresotunel_basura || 0), 0);

    let sobrante = remitidas - totalLibras - totalBasura;
    if (sobrante < 0) sobrante = 0;

    const rendimiento = totalLibras + totalBasura > 0
      ? (totalLibras / (totalLibras + totalBasura)) * 100
      : 0;

    // ELIMINAR PREVIA
    const [old] = await conmysql.query(
      `SELECT liquidacion_id FROM liquidacion WHERE lote_id=? AND liquidacion_tipo=?`,
      [lote_id, map.tipoBD]
    );

    if (old.length) {
      await conmysql.query(`DELETE FROM liquidacion_detalle WHERE liquidacion_id=?`, [old[0].liquidacion_id]);
      await conmysql.query(`DELETE FROM liquidacion WHERE liquidacion_id=?`, [old[0].liquidacion_id]);
    }

    // AGRUPACIÓN
    const detMap = {};
    ing.forEach(i => {
      const key = [
        i.clase_descripcion,
        i.talla_descripcion,
        i.orden_codigo,
        i.glaseo_cantidad,
        i.color_descripcion,
        i.corte_descripcion,
        i.presentacion_descripcion,
        i.peso_descripcion
      ].join("|");

      if (!detMap[key]) {
        detMap[key] = {
          clase: i.clase_descripcion,
          talla: i.talla_descripcion,
          orden: i.orden_codigo,
          glaseo: i.glaseo_cantidad,
          color: i.color_descripcion,
          corte: i.corte_descripcion,
          presentacion: i.presentacion_descripcion,
          peso: i.peso_descripcion,
          cajas: 0,
          coches: 0,
          libras: 0
        };
      }

      detMap[key].cajas += Number(i.ingresotunel_cajas || 0);
      detMap[key].coches += 1;
      detMap[key].libras += Number(i.ingresotunel_total);
    });

    const totalCajas = Object.values(detMap).reduce((s, d) => s + d.cajas, 0);

    // INSERT CABECERA
    const [ins] = await conmysql.query(
      `
      INSERT INTO liquidacion
      (lote_id, liquidacion_tipo, liquidacion_rendimiento,
       liquidacion_basura, liquidacion_sobrante, 
       liquidacion_total_libras, total_cajas)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
      [lote_id, map.tipoBD, rendimiento, totalBasura, sobrante, totalLibras, totalCajas]
    );

    const liquidacion_id = ins.insertId;

    // DETALLES
    for (const d of Object.values(detMap)) {
      await conmysql.query(
        `
        INSERT INTO liquidacion_detalle
        (liquidacion_id, talla, clase, color, corte, peso, glaseo,
         presentacion, orden, cajas, coches, libras)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
        [
          liquidacion_id,
          d.talla, d.clase, d.color, d.corte, d.peso,
          d.glaseo, d.presentacion, d.orden,
          d.cajas, d.coches, d.libras
        ]
      );
    }

    res.json({ liquidacion_id });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};
