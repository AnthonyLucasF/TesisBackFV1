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
   Devuelve campos ya listos: empacado/sobrante/basura/clasificado/procesado
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

        -- ✅ NUEVOS CAMPOS CLAROS
        li.liquidacion_total_empacado   AS total_empacado,
        li.liquidacion_total_sobrante   AS total_sobrante,
        li.liquidacion_total_basura     AS total_basura,
        li.liquidacion_total_clasificado AS total_clasificado,
        li.liquidacion_total_procesado  AS total_procesado,

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

        li.liquidacion_total_empacado   AS total_empacado,
        li.liquidacion_total_sobrante   AS total_sobrante,
        li.liquidacion_total_basura     AS total_basura,
        li.liquidacion_total_clasificado AS total_clasificado,
        li.liquidacion_total_procesado  AS total_procesado,

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
        cajas, coches, libras_empacado, libras_sobrante, libras_basura, libras_procesado
      FROM liquidacion_detalle
      WHERE liquidacion_id = ?
      ORDER BY clase, talla, orden
      `,
      [id]
    );

    res.json({ cabecera: cab[0], detalles: det });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ================================================================
   POST /liquidacion
   REGLAS:
   - Empacado = Σ subtotales
   - Sobrante = Σ sobrantes
   - Basura   = Σ basura
   - Clasificado = 0 (por ahora)
   - Procesado = Empacado + Sobrante + Clasificado + Basura
================================================================ */
export const postLiquidacion = async (req, res) => {
  try {
    const { lote_id, tipo } = req.body;

    const map = mapTipoBD(tipo);
    if (!map) return res.status(400).json({ message: "Tipo inválido" });

    // 1) Ingresos del lote por tipo
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
             o.orden_microlote,
             ch.coche_descripcion
      FROM ingresotunel it
      LEFT JOIN talla t ON it.talla_id=t.talla_id
      LEFT JOIN clase c ON it.clase_id=c.clase_id
      LEFT JOIN color col ON it.color_id=col.color_id
      LEFT JOIN corte co ON it.corte_id=co.corte_id
      LEFT JOIN peso p ON it.peso_id=p.peso_id
      LEFT JOIN glaseo g ON it.glaseo_id=g.glaseo_id
      LEFT JOIN presentacion pr ON it.presentacion_id=pr.presentacion_id
      LEFT JOIN orden o ON it.orden_id=o.orden_id
      LEFT JOIN coche ch ON it.coche_id=ch.coche_id
      WHERE it.lote_id=? AND it.tipo_id=?
      `,
      [lote_id, map.tipoId]
    );

    if (!ing.length) return res.status(400).json({ message: "No ingresos para este tipo" });

    // 2) Lote
    const [[lot]] = await conmysql.query(
      `SELECT lote_libras_remitidas, lote_peso_promedio FROM lote WHERE lote_id=?`,
      [lote_id]
    );
    const pesoPromedio = Number(lot?.lote_peso_promedio || 0);

    // 3) ✅ SUMAS según reglas
    const totalEmpacado = ing.reduce((s, x) => s + Number(x.ingresotunel_subtotales || 0), 0);
    const totalSobrante = ing.reduce((s, x) => s + Number(x.ingresotunel_sobrante || 0), 0);
    const totalBasura = ing.reduce((s, x) => s + Number(x.ingresotunel_basura || 0), 0);

    // ✅ apartado (ignorar por ahora)
    const totalClasificado = 0;

    const totalProcesado = totalEmpacado + totalSobrante + totalClasificado + totalBasura;

    // 4) Rendimiento (mantengo base simple: empacado sobre peso promedio)
    //    Si luego quieres fórmula especial para cola, lo ajustamos aquí.
    const rendimiento = pesoPromedio > 0 ? (totalEmpacado / pesoPromedio) * 100 : 0;

    // 5) Eliminar liquidación previa (mismo lote + mismo tipo)
    const [old] = await conmysql.query(
      `SELECT liquidacion_id FROM liquidacion WHERE lote_id=? AND liquidacion_tipo=?`,
      [lote_id, map.tipoBD]
    );
    if (old.length) {
      await conmysql.query(`DELETE FROM liquidacion_detalle WHERE liquidacion_id=?`, [old[0].liquidacion_id]);
      await conmysql.query(`DELETE FROM liquidacion WHERE liquidacion_id=?`, [old[0].liquidacion_id]);
    }

    // 6) Agrupar detalles (por clase/talla/orden/peso/etc.)
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
          libras_empacado: 0,
          libras_sobrante: 0,
          libras_basura: 0,
          libras_procesado: 0
        };
      }

      // ✅ OJO: tu campo real es ingresotunel_n_cajas (NO ingresotunel_cajas)
      const cajas = Number(i.ingresotunel_n_cajas || 0);

      const emp = Number(i.ingresotunel_subtotales || 0);
      const sob = Number(i.ingresotunel_sobrante || 0);
      const bas = Number(i.ingresotunel_basura || 0);
      const cla = 0; // apartado

      detMap[key].cajas += cajas;
      detMap[key].coches += 1;
      detMap[key].libras_empacado += emp;
      detMap[key].libras_sobrante += sob;
      detMap[key].libras_basura += bas;
      detMap[key].libras_procesado += (emp + sob + cla + bas);
    });

    const totalCajas = Object.values(detMap).reduce((s, d) => s + Number(d.cajas || 0), 0);

    // 7) Insertar cabecera (con columnas nuevas)
    const [ins] = await conmysql.query(
      `
      INSERT INTO liquidacion
      (lote_id, liquidacion_tipo, liquidacion_rendimiento,
       liquidacion_total_empacado, liquidacion_total_sobrante,
       liquidacion_total_basura, liquidacion_total_clasificado,
       liquidacion_total_procesado, total_cajas)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        lote_id,
        map.tipoBD,
        Number(rendimiento.toFixed(2)),
        totalEmpacado,
        totalSobrante,
        totalBasura,
        totalClasificado,
        totalProcesado,
        totalCajas
      ]
    );

    const liquidacion_id = ins.insertId;

    // 8) Insertar detalles (con libras separadas)
    for (const d of Object.values(detMap)) {
      await conmysql.query(
        `
        INSERT INTO liquidacion_detalle
        (liquidacion_id, talla, clase, color, corte, peso, glaseo,
         presentacion, orden, cajas, coches,
         libras_empacado, libras_sobrante, libras_basura, libras_procesado)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          liquidacion_id,
          d.talla, d.clase, d.color, d.corte, d.peso,
          d.glaseo, d.presentacion, d.orden,
          d.cajas, d.coches,
          d.libras_empacado, d.libras_sobrante, d.libras_basura, d.libras_procesado
        ]
      );
    }

    res.json({ liquidacion_id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};
