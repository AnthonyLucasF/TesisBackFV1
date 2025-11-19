/* // src/controladores/liquidacionCtrl.js
import { conmysql } from "../db.js";
import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';

pdfMake.vfs = pdfFonts.pdfMake.vfs;

// GET: Obtener todas las liquidaciones con JOINs, ordenadas por fecha descendente. Opcional filtro por tipo (entero/cola)
export const getLiquidacion = async (req, res) => {
  try {
    const { tipo } = req.query; // ?tipo=entero o cola
    let query = `
      SELECT li.*, i.ingresotunel_id, l.lote_id, l.lote_codigo, l.lote_tipo as lote_tipo_descripcion
      FROM liquidacion li
      LEFT JOIN ingresotunel i ON li.ingresotunel_id = i.ingresotunel_id
      LEFT JOIN lote l ON i.lote_id = l.lote_id
    `;
    const params = [];

    if (tipo) {
      query += ' WHERE li.liquidacion_tipo = ?';
      params.push(tipo);
    }

    query += ' ORDER BY li.liquidacion_fecha DESC';

    const [result] = await conmysql.query(query, params);
    res.json(result);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// GET por ID con JOINs
export const getLiquidacionxid = async (req, res) => {
  try {
    const [result] = await conmysql.query(`
      SELECT li.*, i.ingresotunel_id, l.lote_id, l.lote_codigo, l.lote_tipo as lote_tipo_descripcion
      FROM liquidacion li
      LEFT JOIN ingresotunel i ON li.ingresotunel_id = i.ingresotunel_id
      LEFT JOIN lote l ON i.lote_id = l.lote_id
      WHERE li.liquidacion_id = ?
    `, [req.params.id]);
    if (result.length <= 0) return res.status(404).json({ liquidacion_id: 0, message: "Liquidación no encontrada" });
    res.json(result[0]);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// POST: Generar liquidación desde uno o varios ingresos
export const postLiquidacion = async (req, res) => {
  try {
    let { ingresotunel_id, liquidacion_observaciones, liquidacion_tipo } = req.body;

    if (!ingresotunel_id) return res.status(400).json({ message: "ingresotunel_id required (puede ser array)" });
    if (!Array.isArray(ingresotunel_id)) ingresotunel_id = [ingresotunel_id];

    const [ingresos] = await conmysql.query('SELECT * FROM ingresotunel WHERE ingresotunel_id IN (?)', [ingresotunel_id]);
    if (ingresos.length !== ingresotunel_id.length) return res.status(404).json({ message: "Algunos ingresos no encontrados" });

    const loteId = ingresos[0].lote_id;
    if (ingresos.some(i => i.lote_id !== loteId)) return res.status(400).json({ message: "Ingresos deben pertenecer al mismo lote" });

    const [lote] = await conmysql.query('SELECT lote_peso_promedio, tipo_id, parent_lote_id FROM lote WHERE lote_id = ?', [loteId]);
    const promedio = lote[0].lote_peso_promedio || 0;
    const loteTipoId = lote[0].tipo_id;
    const parentId = lote[0].parent_lote_id || 0;

    const [tipoResult] = await conmysql.query('SELECT tipo_descripcion FROM tipo WHERE tipo_id = ?', [loteTipoId]);
    const loteTipo = tipoResult[0].tipo_descripcion.toLowerCase();

    let total_empacado = 0;
    let total_sobrante = 0;
    let total_basura_ing = 0;
    ingresos.forEach(i => {
      total_empacado += i.ingresotunel_total || 0;
      total_sobrante += i.ingresotunel_sobrante || 0;
      total_basura_ing += i.ingresotunel_basura || 0;
    });

    let basura_parent = 0;
    if (loteTipo.includes('cola') && parentId) {
      const [descabezadoBasura] = await conmysql.query('SELECT SUM(descabezado_basura) as basura FROM descabezado WHERE lote_id = ?', [parentId]);
      basura_parent += descabezadoBasura[0].basura || 0;

      const [peladoBasura] = await conmysql.query('SELECT SUM(pelado_basura) as basura FROM pelado WHERE lote_id = ?', [parentId]);
      basura_parent += peladoBasura[0].basura || 0;
    }

    const [defBasura] = await conmysql.query('SELECT SUM(defectos_basura) as def_basura FROM defectos WHERE lote_id = ?', [loteId]);
    const basura_def = defBasura[0].def_basura || 0;

    const total_basura = total_basura_ing + basura_parent + basura_def;

    let rendimiento = 0;
    if (loteTipo.includes('entero')) {
      rendimiento = promedio > 0 ? ((total_empacado - total_sobrante) / promedio * 100).toFixed(2) : 0;
    } else {
      rendimiento = promedio > 0 ? (total_empacado / (promedio - total_basura) * 100).toFixed(2) : 0;
    }

    const tipoLiquidacion = liquidacion_tipo || (loteTipo.includes('entero') ? 'entero' : 'cola');

    const fecha = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const ingresotunel_ids = ingresotunel_id.join(',');

    const [insertResult] = await conmysql.query(
      'INSERT INTO liquidacion (ingresotunel_id, liquidacion_fecha, liquidacion_rendimiento, liquidacion_basura, liquidacion_observaciones, liquidacion_tipo) VALUES (?, ?, ?, ?, ?, ?)',
      [ingresotunel_ids, fecha, rendimiento, total_basura, liquidacion_observaciones || '', tipoLiquidacion]
    );

    const nuevoId = insertResult.insertId;

    const [nuevo] = await conmysql.query(`
      SELECT li.*, i.ingresotunel_id, l.lote_id, l.lote_codigo, l.lote_tipo as lote_tipo_descripcion
      FROM liquidacion li
      LEFT JOIN ingresotunel i ON li.ingresotunel_id = i.ingresotunel_id
      LEFT JOIN lote l ON i.lote_id = l.lote_id
      WHERE li.liquidacion_id = ?
    `, [nuevoId]);

    global._io.emit("liquidacion_generada", nuevo[0]);
    res.json(nuevo[0]);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// PUT: Actualizar liquidación completa
export const putLiquidacion = async (req, res) => {
  try {
    const { id } = req.params;
    let { ingresotunel_id, liquidacion_observaciones, liquidacion_tipo } = req.body;

    if (!ingresotunel_id) return res.status(400).json({ message: "ingresotunel_id required (puede ser array)" });
    if (!Array.isArray(ingresotunel_id)) ingresotunel_id = [ingresotunel_id];

    const [ingresos] = await conmysql.query('SELECT * FROM ingresotunel WHERE ingresotunel_id IN (?)', [ingresotunel_id]);
    if (ingresos.length !== ingresotunel_id.length) return res.status(404).json({ message: "Algunos ingresos no encontrados" });

    const loteId = ingresos[0].lote_id;
    if (ingresos.some(i => i.lote_id !== loteId)) return res.status(400).json({ message: "Ingresos deben pertenecer al mismo lote" });

    const [lote] = await conmysql.query('SELECT lote_peso_promedio, tipo_id, parent_lote_id FROM lote WHERE lote_id = ?', [loteId]);
    const promedio = lote[0].lote_peso_promedio || 0;
    const loteTipoId = lote[0].tipo_id;
    const parentId = lote[0].parent_lote_id || 0;

    const [tipoResult] = await conmysql.query('SELECT tipo_descripcion FROM tipo WHERE tipo_id = ?', [loteTipoId]);
    const loteTipo = tipoResult[0].tipo_descripcion.toLowerCase();

    let total_empacado = 0;
    let total_sobrante = 0;
    let total_basura_ing = 0;
    ingresos.forEach(i => {
      total_empacado += i.ingresotunel_total || 0;
      total_sobrante += i.ingresotunel_sobrante || 0;
      total_basura_ing += i.ingresotunel_basura || 0;
    });

    let basura_parent = 0;
    if (loteTipo.includes('cola') && parentId) {
      const [descabezadoBasura] = await conmysql.query('SELECT SUM(descabezado_basura) as basura FROM descabezado WHERE lote_id = ?', [parentId]);
      basura_parent += descabezadoBasura[0].basura || 0;

      const [peladoBasura] = await conmysql.query('SELECT SUM(pelado_basura) as basura FROM pelado WHERE lote_id = ?', [parentId]);
      basura_parent += peladoBasura[0].basura || 0;
    }

    const [defBasura] = await conmysql.query('SELECT SUM(defectos_basura) as def_basura FROM defectos WHERE lote_id = ?', [loteId]);
    const basura_def = defBasura[0].def_basura || 0;

    const total_basura = total_basura_ing + basura_parent + basura_def;

    let rendimiento = 0;
    if (loteTipo.includes('entero')) {
      rendimiento = promedio > 0 ? ((total_empacado - total_sobrante) / promedio * 100).toFixed(2) : 0;
    } else {
      rendimiento = promedio > 0 ? (total_empacado / (promedio - total_basura) * 100).toFixed(2) : 0;
    }

    const tipoLiquidacion = liquidacion_tipo || (loteTipo.includes('entero') ? 'entero' : 'cola');
    const ingresotunel_ids = ingresotunel_id.join(',');

    const [updateResult] = await conmysql.query(
      'UPDATE liquidacion SET ingresotunel_id = ?, liquidacion_rendimiento = ?, liquidacion_basura = ?, liquidacion_observaciones = ?, liquidacion_tipo = ? WHERE liquidacion_id = ?',
      [ingresotunel_ids, rendimiento, total_basura, liquidacion_observaciones || '', tipoLiquidacion, id]
    );

    if (updateResult.affectedRows <= 0) return res.status(404).json({ message: "Liquidación no encontrada" });

    const [actualizado] = await conmysql.query(`
      SELECT li.*, i.ingresotunel_id, l.lote_id, l.lote_codigo, l.lote_tipo as lote_tipo_descripcion
      FROM liquidacion li
      LEFT JOIN ingresotunel i ON li.ingresotunel_id = i.ingresotunel_id
      LEFT JOIN lote l ON i.lote_id = l.lote_id
      WHERE li.liquidacion_id = ?
    `, [id]);

    global._io.emit("liquidacion_actualizada", actualizado[0]);
    res.json(actualizado[0]);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// PATCH: Actualización parcial, recalcular si relevante
export const pathLiquidacion = async (req, res) => {
  try {
    const { id } = req.params;
    const campos = Object.keys(req.body);
    const valores = Object.values(req.body);

    if (campos.length === 0) return res.status(400).json({ message: "No se enviaron campos para actualizar" });

    const setClause = campos.map(campo => `${campo} = IFNULL(?, ${campo})`).join(', ');
    const [updateResult] = await conmysql.query(
      `UPDATE liquidacion SET ${setClause} WHERE liquidacion_id = ?`,
      [...valores, id]
    );

    if (updateResult.affectedRows <= 0) return res.status(404).json({ message: "Liquidación no encontrada" });

    // Recalcular si ingresotunel_id cambió
    if (campos.includes('ingresotunel_id')) {
      // Lógica de recalc similar a put puede implementarse aquí
    }

    const [actualizado] = await conmysql.query(`
      SELECT li.*, i.ingresotunel_id, l.lote_id, l.lote_codigo, l.lote_tipo as lote_tipo_descripcion
      FROM liquidacion li
      LEFT JOIN ingresotunel i ON li.ingresotunel_id = i.ingresotunel_id
      LEFT JOIN lote l ON i.lote_id = l.lote_id
      WHERE li.liquidacion_id = ?
    `, [id]);

    global._io.emit("liquidacion_actualizada", actualizado[0]);
    res.json(actualizado[0]);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// DELETE: Eliminar liquidación, emitir WS
export const deleteLiquidacion = async (req, res) => {
  try {
    const { id } = req.params;

    await conmysql.query('DELETE FROM liquidacion WHERE liquidacion_id = ?', [id]);

    global._io.emit("liquidacion_eliminada", { liquidacion_id: parseInt(id) });

    res.status(202).json({ message: "Liquidación eliminada con éxito" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
// Emitir evento WebSocket si una orden cambia a 'cumplida'
export const emitirOrdenCumplida = async (orden_id) => {
  try {
    const [orden] = await conmysql.query('SELECT * FROM orden WHERE orden_id = ?', [orden_id]);
    if (orden.length === 0) return;
    const estado = orden[0].orden_estado.toLowerCase();
  }
  catch (error) {
    console.error("Error al emitir orden cumplida:", error);
  }
} */



// src/controladores/liquidacionCtrl.js
import { conmysql } from "../db.js";
import pdfMake from "pdfmake/build/pdfmake.js";
import pdfFonts from "pdfmake/build/vfs_fonts.js";
import fs from "fs";
import path from "path";

pdfMake.vfs = pdfFonts.vfs;

/* ======================================================================================
   ===============================  GET: OBTENER LISTA  =================================
   ====================================================================================== */
export const getLiquidacion = async (req, res) => {
  try {
    const { tipo } = req.query;

    let query = `
      SELECT li.*, i.ingresotunel_id, l.lote_id, l.lote_codigo, l.lote_tipo AS lote_tipo_descripcion
      FROM liquidacion li
      LEFT JOIN ingresotunel i ON li.ingresotunel_id = i.ingresotunel_id
      LEFT JOIN lote l ON i.lote_id = l.lote_id
    `;
    const params = [];

    if (tipo) {
      query += ` WHERE li.liquidacion_tipo = ?`;
      params.push(tipo);
    }

    query += ` ORDER BY li.liquidacion_fecha DESC`;

    const [result] = await conmysql.query(query, params);
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* ======================================================================================
   ===============================  GET: OBTENER POR ID  ================================
   ====================================================================================== */
export const getLiquidacionxid = async (req, res) => {
  try {
    const [result] = await conmysql.query(`
      SELECT li.*, i.ingresotunel_id, l.lote_id, l.lote_codigo, l.lote_tipo AS lote_tipo_descripcion
      FROM liquidacion li
      LEFT JOIN ingresotunel i ON li.ingresotunel_id = i.ingresotunel_id
      LEFT JOIN lote l ON i.lote_id = l.lote_id
      WHERE li.liquidacion_id = ?
    `, [req.params.id]);

    if (result.length === 0)
      return res.status(404).json({ liquidacion_id: 0, message: "Liquidación no encontrada" });

    res.json(result[0]);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* ======================================================================================
   ===========================  POST: CREAR LIQUIDACIÓN + PDF  ==========================
   ====================================================================================== */
export const postLiquidacion = async (req, res) => {
  try {
    let { ingresotunel_id, liquidacion_observaciones, liquidacion_tipo } = req.body;

    if (!ingresotunel_id)
      return res.status(400).json({ message: "ingresotunel_id required (puede ser array)" });

    if (!Array.isArray(ingresotunel_id)) ingresotunel_id = [ingresotunel_id];

    // Traer ingresos
    const [ingresos] = await conmysql.query(
      `SELECT * FROM ingresotunel WHERE ingresotunel_id IN (?)`,
      [ingresotunel_id]
    );

    if (ingresos.length !== ingresotunel_id.length)
      return res.status(404).json({ message: "Algunos ingresos no encontrados" });

    // Validar lote
    const loteId = ingresos[0].lote_id;
    if (ingresos.some(i => i.lote_id !== loteId))
      return res.status(400).json({ message: "Ingresos deben pertenecer al mismo lote" });

    // Datos lote
    const [lote] = await conmysql.query(
      `SELECT lote_peso_promedio, tipo_id, parent_lote_id, lote_codigo 
       FROM lote WHERE lote_id = ?`,
      [loteId]
    );

    const promedio = lote[0].lote_peso_promedio || 0;
    const parentId = lote[0].parent_lote_id || 0;

    // Tipo lote
    const [tipoResult] = await conmysql.query(
      `SELECT tipo_descripcion FROM tipo WHERE tipo_id = ?`,
      [lote[0].tipo_id]
    );
    const loteTipo = tipoResult[0].tipo_descripcion.toLowerCase();

    // Totales
    let total_empacado = 0, total_sobrante = 0, total_basura_ing = 0;

    ingresos.forEach(i => {
      total_empacado += i.ingresotunel_total || 0;
      total_sobrante += i.ingresotunel_sobrante || 0;
      total_basura_ing += i.ingresotunel_basura || 0;
    });

    // Basura parent si cola
    let basura_parent = 0;
    if (loteTipo.includes("cola") && parentId) {
      const [desc] = await conmysql.query(
        `SELECT SUM(descabezado_basura) AS basura FROM descabezado WHERE lote_id = ?`,
        [parentId]
      );
      basura_parent += desc[0].basura || 0;

      const [pel] = await conmysql.query(
        `SELECT SUM(pelado_basura) AS basura FROM pelado WHERE lote_id = ?`,
        [parentId]
      );
      basura_parent += pel[0].basura || 0;
    }

    // Basura defectos
    const [def] = await conmysql.query(
      `SELECT SUM(defectos_basura) AS def_basura FROM defectos WHERE lote_id = ?`,
      [loteId]
    );
    const basura_def = def[0].def_basura || 0;

    const total_basura = total_basura_ing + basura_parent + basura_def;

    // ========================= CALCULAR RENDIMIENTO =========================
    let rendimiento = 0;

    if (loteTipo.includes("entero")) {
      rendimiento = promedio > 0
        ? ((total_empacado - total_sobrante) / promedio * 100).toFixed(2)
        : 0;
    } else {
      rendimiento = promedio > 0
        ? (total_empacado / (promedio - total_basura) * 100).toFixed(2)
        : 0;
    }

    const tipoLiquidacion =
      liquidacion_tipo || (loteTipo.includes("entero") ? "entero" : "cola");

    // ========================= INSERTAR LIQUIDACIÓN =========================
    const fecha = new Date().toISOString().slice(0, 19).replace("T", " ");
    const ids_str = ingresotunel_id.join(",");

    const [insert] = await conmysql.query(
      `INSERT INTO liquidacion 
       (ingresotunel_id, liquidacion_fecha, liquidacion_rendimiento,
        liquidacion_basura, liquidacion_observaciones, liquidacion_tipo)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [ids_str, fecha, rendimiento, total_basura, liquidacion_observaciones || "", tipoLiquidacion]
    );

    const nuevoId = insert.insertId;

    /* ======================================================================================
       ============================= GENERAR PDF =============================================
       ====================================================================================== */
    const pdfDir = path.resolve("public/pdf/liquidaciones");
    if (!fs.existsSync(pdfDir)) fs.mkdirSync(pdfDir, { recursive: true });

    const filePath = path.join(pdfDir, `liq-${nuevoId}.pdf`);

    const docDefinition = {
      content: [
        { text: "LIQUIDACIÓN", style: "header" },
        { text: `ID: ${nuevoId}` },
        { text: `Lote: ${lote[0].lote_codigo}` },
        { text: `Tipo: ${tipoLiquidacion}` },
        { text: `Rendimiento: ${rendimiento}%` },
        { text: `Basura total: ${total_basura} kg` },
        { text: " " },
        { text: "Firma: _______________________________", margin: [0, 40] }
      ],
      styles: {
        header: { fontSize: 20, bold: true, alignment: "center", margin: [0, 0, 0, 20] }
      }
    };

    const pdfDoc = pdfMake.createPdf(docDefinition);
    pdfDoc.getBuffer(async (buffer) => {
      fs.writeFileSync(filePath, buffer);

      await conmysql.query(
        `UPDATE liquidacion SET liquidacion_pdf_path = ? WHERE liquidacion_id = ?`,
        [`/pdf/liquidaciones/liq-${nuevoId}.pdf`, nuevoId]
      );
    });

    // WS Emit
    global._io.emit("liquidacion_generada", { liquidacion_id: nuevoId });

    res.json({
      liquidacion_id: nuevoId,
      rendimiento,
      message: "Liquidación generada correctamente con PDF"
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* ======================================================================================
   ===========================  PUT: ACTUALIZAR LIQUIDACIÓN  ============================
   ====================================================================================== */
export const putLiquidacion = async (req, res) => {
  try {
    const { id } = req.params;
    let { ingresotunel_id, liquidacion_observaciones, liquidacion_tipo } = req.body;

    if (!ingresotunel_id)
      return res.status(400).json({ message: "ingresotunel_id required (puede ser array)" });

    if (!Array.isArray(ingresotunel_id)) ingresotunel_id = [ingresotunel_id];

    // Validaciones iguales al POST
    const [ingresos] = await conmysql.query(
      `SELECT * FROM ingresotunel WHERE ingresotunel_id IN (?)`,
      [ingresotunel_id]
    );
    if (ingresos.length !== ingresotunel_id.length)
      return res.status(404).json({ message: "Algunos ingresos no encontrados" });

    const loteId = ingresos[0].lote_id;
    if (ingresos.some(i => i.lote_id !== loteId))
      return res.status(400).json({ message: "Ingresos deben pertenecer al mismo lote" });

    const [lote] = await conmysql.query(
      `SELECT lote_peso_promedio, tipo_id, parent_lote_id 
       FROM lote WHERE lote_id = ?`,
      [loteId]
    );

    const promedio = lote[0].lote_peso_promedio || 0;
    const parentId = lote[0].parent_lote_id || 0;

    const [tipoResult] = await conmysql.query(
      `SELECT tipo_descripcion FROM tipo WHERE tipo_id = ?`,
      [lote[0].tipo_id]
    );
    const loteTipo = tipoResult[0].tipo_descripcion.toLowerCase();

    // Totales
    let total_empacado = 0, total_sobrante = 0, total_basura_ing = 0;

    ingresos.forEach(i => {
      total_empacado += i.ingresotunel_total || 0;
      total_sobrante += i.ingresotunel_sobrante || 0;
      total_basura_ing += i.ingresotunel_basura || 0;
    });

    let basura_parent = 0;
    if (loteTipo.includes("cola") && parentId) {
      const [desc] = await conmysql.query(
        `SELECT SUM(descabezado_basura) AS basura FROM descabezado WHERE lote_id = ?`,
        [parentId]
      );
      basura_parent += desc[0].basura || 0;

      const [pel] = await conmysql.query(
        `SELECT SUM(pelado_basura) AS basura FROM pelado WHERE lote_id = ?`,
        [parentId]
      );
      basura_parent += pel[0].basura || 0;
    }

    const [def] = await conmysql.query(
      `SELECT SUM(defectos_basura) AS def_basura FROM defectos WHERE lote_id = ?`,
      [loteId]
    );
    const basura_def = def[0].def_basura || 0;

    const total_basura = total_basura_ing + basura_parent + basura_def;

    // Calcular rendimiento
    let rendimiento = 0;
    if (loteTipo.includes("entero")) {
      rendimiento = promedio > 0
        ? ((total_empacado - total_sobrante) / promedio * 100).toFixed(2)
        : 0;
    } else {
      rendimiento = promedio > 0
        ? (total_empacado / (promedio - total_basura) * 100).toFixed(2)
        : 0;
    }

    const tipoLiquidacion =
      liquidacion_tipo || (loteTipo.includes("entero") ? "entero" : "cola");

    const ids_str = ingresotunel_id.join(",");

    // Actualizar
    const [update] = await conmysql.query(
      `UPDATE liquidacion 
       SET ingresotunel_id = ?, liquidacion_rendimiento = ?, liquidacion_basura = ?, 
           liquidacion_observaciones = ?, liquidacion_tipo = ?
       WHERE liquidacion_id = ?`,
      [ids_str, rendimiento, total_basura, liquidacion_observaciones || "", tipoLiquidacion, id]
    );

    if (update.affectedRows === 0)
      return res.status(404).json({ message: "Liquidación no encontrada" });

    const [actualizado] = await conmysql.query(`
      SELECT * FROM liquidacion WHERE liquidacion_id = ?
    `, [id]);

    global._io.emit("liquidacion_actualizada", actualizado[0]);

    res.json(actualizado[0]);

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* ======================================================================================
   =============================  PATCH: ACTUALIZACIÓN PARCIAL  ==========================
   ====================================================================================== */
export const pathLiquidacion = async (req, res) => {
  try {
    const { id } = req.params;

    const campos = Object.keys(req.body);
    const valores = Object.values(req.body);

    if (campos.length === 0)
      return res.status(400).json({ message: "No se enviaron campos para actualizar" });

    const setClause = campos
      .map(campo => `${campo} = IFNULL(?, ${campo})`)
      .join(", ");

    const [update] = await conmysql.query(
      `UPDATE liquidacion SET ${setClause} WHERE liquidacion_id = ?`,
      [...valores, id]
    );

    if (update.affectedRows === 0)
      return res.status(404).json({ message: "Liquidación no encontrada" });

    const [actualizado] = await conmysql.query(
      `SELECT * FROM liquidacion WHERE liquidacion_id = ?`,
      [id]
    );

    global._io.emit("liquidacion_actualizada", actualizado[0]);

    res.json(actualizado[0]);

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* ======================================================================================
   =============================  DELETE: ELIMINAR  ======================================
   ====================================================================================== */
export const deleteLiquidacion = async (req, res) => {
  try {
    const { id } = req.params;

    await conmysql.query(
      `DELETE FROM liquidacion WHERE liquidacion_id = ?`,
      [id]
    );

    global._io.emit("liquidacion_eliminada", { liquidacion_id: parseInt(id) });

    res.json({ message: "Liquidación eliminada con éxito" });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* ======================================================================================
   =======================  WS: EMITIR ORDEN CUMPLIDA (SIN CAMBIO)  ======================
   ====================================================================================== */
export const emitirOrdenCumplida = async (orden_id) => {
  try {
    const [orden] = await conmysql.query(
      `SELECT * FROM orden WHERE orden_id = ?`,
      [orden_id]
    );

    if (orden.length === 0) return;

    const estado = orden[0].orden_estado.toLowerCase();

    // Aquí podrías emitir condición si estado = cumplida
  } catch (error) {
    console.error("Error al emitir orden cumplida:", error);
  }
};
