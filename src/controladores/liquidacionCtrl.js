import { conmysql } from "../db.js";

// GET: Obtener liquidaciones por tipo (entero/cola), ordenadas DESC
export const getLiquidacion = async (req, res) => {
  try {
    const { tipo } = req.query;
    let whereClause = '';
    if (tipo) {
      whereClause = 'WHERE liquidacion_tipo = ?';
    }
    const [result] = await conmysql.query(`SELECT * FROM liquidacion ${whereClause} ORDER BY liquidacion_fecha DESC`, tipo ? [tipo] : []);
    res.json(result);
  } catch (error) {
    return res.status(500).json({ message: "Error al consultar Liquidaciones" });
  }
};

// GET por ID
export const getLiquidacionxid = async (req, res) => {
  try {
    const [result] = await conmysql.query('SELECT * FROM liquidacion WHERE liquidacion_id = ?', [req.params.id]);
    if (result.length <= 0) return res.status(404).json({ liquidacion_id: 0, message: "Liquidación no encontrada" });
    res.json(result[0]);
  } catch (error) {
    return res.status(500).json({ message: "Error del Servidor" });
  }
};

export const postLiquidacion = async (req, res) => {
  try {
    const { lote_id, tipo } = req.body;

    if (!lote_id || !tipo) {
      return res.status(400).json({ message: "lote_id y tipo son requeridos" });
    }

    let tipoDB;
    if (tipo === 'entero') tipoDB = 'Entero'; // Fix: Capitalize to match DB tipo_descripcion
    else if (tipo === 'cola') tipoDB = 'Cola'; // Fix
    else return res.status(400).json({ message: "Tipo inválido" });

    const [ingresos] = await conmysql.query(
      `SELECT 
        SUM(ingresotunel_total) AS total_empacado,
        SUM(ingresotunel_basura) AS total_basura,
        SUM(ingresotunel_sobrante) AS total_sobrante
       FROM ingresotunel
       WHERE lote_id = ? AND tipo_id IN (SELECT tipo_id FROM tipo WHERE tipo_descripcion = ?)`,
      [lote_id, tipoDB]
    );

    const total_empacado = ingresos[0]?.total_empacado ?? 0;
    const total_basura = ingresos[0]?.total_basura ?? 0;
    const total_sobrante = ingresos[0]?.total_sobrante ?? 0;

    const [lote] = await conmysql.query(
      'SELECT lote_peso_promedio FROM lote WHERE lote_id = ?',
      [lote_id]
    );
    if (!lote[0]) return res.status(404).json({ message: "Lote no encontrado" });

    const promedio = lote[0].lote_peso_promedio ?? 0;

    let rendimiento = 0;
    if (promedio > 0) {
      if (tipo === 'entero') rendimiento = ((total_empacado - total_sobrante) / promedio) * 100;
      else rendimiento = (total_empacado / (promedio - total_basura)) * 100;
    }
    if (isNaN(rendimiento)) rendimiento = 0;

    const [rows] = await conmysql.query(
      `INSERT INTO liquidacion 
        (clasificacion_id, liquidacion_tipo, liquidacion_rendimiento, liquidacion_basura, liquidacion_total_empacado, liquidacion_fecha)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [lote_id, tipo, rendimiento, total_basura, total_empacado]
    );

    if (global._io) global._io.emit("liquidacion_generada", { liquidacion_id: rows.insertId });

    res.json({ id: rows.insertId, message: "Liquidación generada con éxito" });

  } catch (error) {
    console.error("ERROR POST Liquidación:", error);
    res.status(500).json({ message: "Error generando liquidación", error: error.message });
  }
};

// PUT: Update completa
export const putLiquidacion = async (req, res) => {
  try {
    const { id } = req.params;
    const { lote_id, liquidacion_tipo, liquidacion_rendimiento, liquidacion_basura, liquidacion_total_empacado } = req.body;

    const [result] = await conmysql.query(
      'UPDATE liquidacion SET lote_id=?, liquidacion_tipo=?, liquidacion_rendimiento=?, liquidacion_basura=?, liquidacion_total_empacado=? WHERE liquidacion_id=?',
      [lote_id, liquidacion_tipo, liquidacion_rendimiento, liquidacion_basura, liquidacion_total_empacado, id]
    );

    if (result.affectedRows <= 0) return res.status(404).json({ message: "Liquidación no encontrada" });

    const [rows] = await conmysql.query('SELECT * FROM liquidacion WHERE liquidacion_id=?', [id]);
    res.json(rows[0]);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// PATCH: Partial update (e.g., edit fields)
export const patchLiquidacion = async (req, res) => {
  try {
    const { id } = req.params;
    const fields = Object.keys(req.body);
    if (fields.length === 0) return res.status(400).json({ message: "No fields to update" });

    const setClause = fields.map(field => `${field} = ?`).join(', ');
    const values = fields.map(field => req.body[field]);

    const [result] = await conmysql.query(
      `UPDATE liquidacion SET ${setClause} WHERE liquidacion_id = ?`,
      [...values, id]
    );

    if (result.affectedRows <= 0) return res.status(404).json({ message: "Liquidación no encontrada" });

    res.json({ message: "Liquidación actualizada parcialmente" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// DELETE
export const deleteLiquidacion = async (req, res) => {
  try {
    const { id } = req.params;
    await conmysql.query('DELETE FROM liquidacion WHERE liquidacion_id = ?', [id]);
    res.status(202).json({ message: "Liquidación eliminada con éxito" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};