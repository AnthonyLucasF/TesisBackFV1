/* // src/controladores/liquidacionCtrl.js
import { conmysql } from "../db.js";

//   UTILIDAD: MAPEO TIPO → Nombre BD y tipo_id
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

//   GET /liquidacion?tipo=entero|cola
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
        lo.lote_peso_promedio,
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

//   GET /liquidacion/:id
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
        li.total_cajas,
        li.liquidacion_fecha,
        lo.lote_libras_remitidas,
        lo.lote_n_bines,
        pr.proveedor_nombre,
        lo.lote_n_piscina,
        lo.lote_peso_promedio AS peso_promedio
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
        talla, clase, color, corte, peso, glaseo,
        presentacion, orden,
        cajas, coches, libras
      FROM liquidacion_detalle
      WHERE liquidacion_id = ?
      ORDER BY clase, talla, orden
    `,
      [id]
    );

    res.json({
      cabecera: cab[0],
      detalles: det,
    });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

//   POST /liquidacion
export const postLiquidacion = async (req, res) => {
  try {
    const { lote_id, tipo } = req.body;

    const map = mapTipoBD(tipo);
    if (!map) return res.status(400).json({ message: "Tipo inválido" });

//       AUTOCORRECCIÓN TIPO EN INGRESOS
    await conmysql.query(
      `
      UPDATE ingresotunel 
      SET tipo_id = ? 
      WHERE lote_id = ? AND (tipo_id = 0 OR tipo_id IS NULL)
      `,
      [map.tipoId, lote_id]
    );

//       CARGAR INGRESOS
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
             o.orden_microlote
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
      return res.status(400).json({ message: "No ingresos para este tipo" });

//       LOTE
    const [[lot]] = await conmysql.query(
      `SELECT lote_libras_remitidas, lote_peso_promedio FROM lote WHERE lote_id=?`,
      [lote_id]
    );

    const remitidas = Number(lot.lote_libras_remitidas);
    const pesoPromedio = Number(lot.lote_peso_promedio || 0);

//       SUMAS
    const totalLibras = ing.reduce((s, x) => s + Number(x.ingresotunel_total || 0), 0);
    const totalBasura = ing.reduce((s, x) => s + Number(x.ingresotunel_basura || 0), 0);

//       SOBRANTE (según tipo)
    let sobrante = 0;

    if (tipo === "entero") {
      sobrante = pesoPromedio - totalLibras;
    } else {
      sobrante = (pesoPromedio - totalBasura) - totalLibras;
    }

    if (sobrante < 0) sobrante = 0;

//       RENDIMIENTO ACTUALIZADO
    let rendimiento = 0;

    if (tipo === "entero") {
      rendimiento = pesoPromedio > 0
        ? (totalLibras / pesoPromedio) * 100
        : 0;
    } else {
      const base = pesoPromedio - totalBasura;
      rendimiento = base > 0
        ? (totalLibras / base) * 100
        : 0;
    }

//       ELIMINAR LIQUIDACIÓN PREVIA
    const [old] = await conmysql.query(
      `SELECT liquidacion_id FROM liquidacion WHERE lote_id=? AND liquidacion_tipo=?`,
      [lote_id, map.tipoBD]
    );

    if (old.length) {
      await conmysql.query(`DELETE FROM liquidacion_detalle WHERE liquidacion_id=?`, [old[0].liquidacion_id]);
      await conmysql.query(`DELETE FROM liquidacion WHERE liquidacion_id=?`, [old[0].liquidacion_id]);
    }

//       AGRUPACIÓN
    const detMap = {};

    ing.forEach(i => {
      const key = [
        i.clase_descripcion,
        i.talla_descripcion,
        i.orden_microlote,
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
          orden: i.orden_microlote,
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

//       INSERTAR CABECERA
    const [ins] = await conmysql.query(
      `
      INSERT INTO liquidacion
      (lote_id, liquidacion_tipo, liquidacion_rendimiento,
       liquidacion_basura, liquidacion_sobrante,
       liquidacion_total_libras, total_cajas)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
      [
        lote_id,
        map.tipoBD,
        rendimiento,
        totalBasura,
        sobrante,
        totalLibras,
        totalCajas
      ]
    );

    const liquidacion_id = ins.insertId;

//       INSERTAR DETALLES
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
 */

// src/controladores/liquidacionCtrl.js
import { conmysql } from "../db.js";

/* ================================================================
   UTILIDAD: MAPEO TIPO → Nombre BD y tipo_id
================================================================ */
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

/* ================================================================
   GET /liquidacion?tipo=entero|cola
================================================================ */
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
        lo.lote_peso_promedio,
        lo.lote_n_bines,
        li.liquidacion_tipo,
        li.liquidacion_rendimiento,
        li.liquidacion_basura,
        li.liquidacion_sobrante,

        -- ✅ OJO: este campo lo usaremos como TOTAL EMPACADO (subtotales)
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

/* ================================================================
   GET /liquidacion/:id
================================================================ */
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

        -- ✅ aquí también: total_libras = total empacado
        li.liquidacion_total_libras AS total_libras,

        li.total_cajas,
        li.liquidacion_fecha,
        lo.lote_libras_remitidas,
        lo.lote_n_bines,
        pr.proveedor_nombre,
        lo.lote_n_piscina,
        lo.lote_peso_promedio AS peso_promedio
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
        talla, clase, color, corte, peso, glaseo,
        presentacion, orden,
        cajas, coches, libras
      FROM liquidacion_detalle
      WHERE liquidacion_id = ?
      ORDER BY clase, talla, orden
    `,
      [id]
    );

    // ✅ opcional: calculamos total_procesado en respuesta (sin tocar BD)
    const empacado = Number(cab[0]?.total_libras || 0);
    const sobrante = Number(cab[0]?.liquidacion_sobrante || 0);
    const basura = Number(cab[0]?.liquidacion_basura || 0);
    const clasificado = 0; // placeholder
    const total_procesado = empacado + sobrante + basura + clasificado;

    res.json({
      cabecera: {
        ...cab[0],
        total_clasificado: clasificado,
        total_procesado,
      },
      detalles: det,
    });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ================================================================
   POST /liquidacion
   Reglas:
   - Empacado = SUM(subtotales)
   - Sobrante = SUM(sobrante)
   - Basura = SUM(basura)
   - Clasificado = 0 (placeholder)
   - Procesado = Empacado + Sobrante + Clasificado + Basura
================================================================ */
export const postLiquidacion = async (req, res) => {
  try {
    const { lote_id, tipo } = req.body;

    const map = mapTipoBD(tipo);
    if (!map) return res.status(400).json({ message: "Tipo inválido" });

    /* -------------------------------------------------------
       AUTOCORRECCIÓN TIPO EN INGRESOS
    -------------------------------------------------------- */
    await conmysql.query(
      `
      UPDATE ingresotunel 
      SET tipo_id = ? 
      WHERE lote_id = ? AND (tipo_id = 0 OR tipo_id IS NULL)
      `,
      [map.tipoId, lote_id]
    );

    /* -------------------------------------------------------
       CARGAR INGRESOS (solo del tipo)
    -------------------------------------------------------- */
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
             o.orden_microlote
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

    if (!ing.length) {
      return res.status(400).json({ message: "No ingresos para este tipo" });
    }

    /* -------------------------------------------------------
       LOTE (para rendimiento)
    -------------------------------------------------------- */
    const [[lot]] = await conmysql.query(
      `SELECT lote_peso_promedio FROM lote WHERE lote_id=?`,
      [lote_id]
    );

    const pesoPromedio = Number(lot?.lote_peso_promedio || 0);

    /* -------------------------------------------------------
       SUMAS (REGLAS NUEVAS)
       Empacado = SUM(subtotales)
       Sobrante = SUM(sobrante)
       Basura   = SUM(basura)
       Clasificado (por ahora 0)
       Procesado = Empacado + Sobrante + Clasificado + Basura
    -------------------------------------------------------- */
    const totalEmpacado = ing.reduce((s, x) => s + Number(x.ingresotunel_subtotales || 0), 0);
    const totalSobrante = ing.reduce((s, x) => s + Number(x.ingresotunel_sobrante || 0), 0);
    const totalBasura = ing.reduce((s, x) => s + Number(x.ingresotunel_basura || 0), 0);

    // ✅ placeholder
    const totalClasificado = 0;

    const totalProcesado = totalEmpacado + totalSobrante + totalClasificado + totalBasura;

    // ✅ total cajas correcto (tu tabla es ingresotunel_n_cajas)
    const totalCajas = ing.reduce((s, x) => s + Number(x.ingresotunel_n_cajas || 0), 0);

    /* -------------------------------------------------------
       RENDIMIENTO (consistente con cola/entero)
       - Entero: empacado / pesoPromedio
       - Cola: empacado / (pesoPromedio - basura)
       (si pesoPromedio = 0 => 0)
    -------------------------------------------------------- */
    let rendimiento = 0;
    if (tipo === "entero") {
      rendimiento = pesoPromedio > 0 ? (totalEmpacado / pesoPromedio) * 100 : 0;
    } else {
      const base = pesoPromedio - totalBasura;
      rendimiento = base > 0 ? (totalEmpacado / base) * 100 : 0;
    }

    /* -------------------------------------------------------
       ELIMINAR LIQUIDACIÓN PREVIA (mismo lote + tipo)
    -------------------------------------------------------- */
    const [old] = await conmysql.query(
      `SELECT liquidacion_id FROM liquidacion WHERE lote_id=? AND liquidacion_tipo=?`,
      [lote_id, map.tipoBD]
    );

    if (old.length) {
      await conmysql.query(`DELETE FROM liquidacion_detalle WHERE liquidacion_id=?`, [old[0].liquidacion_id]);
      await conmysql.query(`DELETE FROM liquidacion WHERE liquidacion_id=?`, [old[0].liquidacion_id]);
    }

    /* -------------------------------------------------------
       AGRUPACIÓN DETALLE
       - libras = suma de SUBTOTALES (empacado)
       - cajas  = suma de ingresotunel_n_cajas
       - coches = conteo de registros (si quieres únicos por coche_id, te lo ajusto)
    -------------------------------------------------------- */
    const detMap = {};

    ing.forEach(i => {
      const key = [
        i.clase_descripcion,
        i.talla_descripcion,
        i.orden_microlote,
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
          orden: i.orden_microlote,
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

      detMap[key].cajas += Number(i.ingresotunel_n_cajas || 0);            // ✅
      detMap[key].coches += 1;
      detMap[key].libras += Number(i.ingresotunel_subtotales || 0);        // ✅ empacado real
    });

    /* -------------------------------------------------------
       INSERTAR CABECERA
       - liquidacion_total_libras = TOTAL EMPACADO (subtotales)
       - liquidacion_sobrante     = SUM(sobrantes)
       - liquidacion_basura       = SUM(basura)
       - total_cajas              = SUM(n_cajas)
    -------------------------------------------------------- */
    const [ins] = await conmysql.query(
      `
      INSERT INTO liquidacion
      (lote_id, liquidacion_tipo, liquidacion_rendimiento,
       liquidacion_basura, liquidacion_sobrante,
       liquidacion_total_libras, total_cajas)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
      [
        lote_id,
        map.tipoBD,
        rendimiento,
        totalBasura,
        totalSobrante,
        totalEmpacado,
        totalCajas
      ]
    );

    const liquidacion_id = ins.insertId;

    /* -------------------------------------------------------
       INSERTAR DETALLES
    -------------------------------------------------------- */
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

    // ✅ devolvemos más info útil por si lo necesitas en frontend
    res.json({
      liquidacion_id,
      totales: {
        empacado: totalEmpacado,
        sobrante: totalSobrante,
        basura: totalBasura,
        clasificado: totalClasificado,
        procesado: totalProcesado,
        rendimiento
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};
