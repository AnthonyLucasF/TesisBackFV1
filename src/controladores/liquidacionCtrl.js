import { conmysql } from "../db.js";

// GET: Obtener liquidaciones por tipo (entero/cola), ordenadas DESC
export const getLiquidacion = async (req, res) => {
  try {
    const { tipo } = req.query;
    let whereClause = '';
    if (tipo) {
      whereClause = 'WHERE liquidacion_tipo = ?';
    }
    const [result] = await conmysql.query(
      `SELECT * FROM liquidacion ${whereClause} ORDER BY liquidacion_fecha DESC`,
      tipo ? [tipo] : []
    );
    res.json(result);
  } catch (error) {
    return res.status(500).json({ message: "Error al consultar Liquidaciones", error: error.message });
  }
};

// GET por ID
export const getLiquidacionxid = async (req, res) => {
  try {
    const [result] = await conmysql.query(
      'SELECT * FROM liquidacion WHERE liquidacion_id = ?',
      [req.params.id]
    );
    if (result.length <= 0) return res.status(404).json({ liquidacion_id: 0, message: "Liquidación no encontrada" });
    res.json(result[0]);
  } catch (error) {
    return res.status(500).json({ message: "Error del Servidor", error: error.message });
  }
};

// GET detalles por liquidacion_id
export const getLiquidacionDetalle = async (req, res) => {
  try {
    const { liquidacion_id } = req.params;
    const [detalle] = await conmysql.query(`
      SELECT i.*, 
             t.tipo_descripcion, 
             c.clase_descripcion,
             co.color_descripcion,
             ta.talla_descripcion,
             p.presentacion_descripcion,
             o.orden_descripcion
      FROM ingresotunel i
      LEFT JOIN tipo t ON i.tipo_id = t.tipo_id
      LEFT JOIN clase c ON i.clase_id = c.clase_id
      LEFT JOIN color co ON i.color_id = co.color_id
      LEFT JOIN talla ta ON i.talla_id = ta.talla_id
      LEFT JOIN presentacion p ON i.presentacion_id = p.presentacion_id
      LEFT JOIN orden o ON i.orden_id = o.orden_id
      WHERE i.liquidacion_id = ?
    `, [liquidacion_id]);
    res.json(detalle);
  } catch (error) {
    return res.status(500).json({ message: "Error al consultar detalles", error: error.message });
  }
};

// POST: Crear liquidación
export const postLiquidacion = async (req, res) => {
  const { lote_id, tipo_id } = req.body;

  if (!lote_id || !tipo_id) {
    return res.status(400).json({ message: "lote_id y tipo_id son obligatorios" });
  }

  try {
    // Crear liquidación
    const [result] = await conmysql.query(`
      INSERT INTO liquidacion (liquidacion_tipo, liquidacion_fecha)
      VALUES (?, NOW())
    `, [tipo_id]);

    const liquidacion_id = result.insertId;

    // Obtener ingresos del lote
    const [ingresos] = await conmysql.query(`
      SELECT * FROM ingresotunel
      WHERE lote_id = ? AND tipo_id = ?
    `, [lote_id, tipo_id]);

    if (ingresos.length === 0) {
      return res.status(404).json({ message: "No existen ingresos para liquidar" });
    }

    // Asignar liquidación a los ingresos
    await conmysql.query(`
      UPDATE ingresotunel
      SET liquidacion_id = ?
      WHERE lote_id = ? AND tipo_id = ?
    `, [liquidacion_id, lote_id, tipo_id]);

    // Totales
    const total_libras = ingresos.reduce((a, b) => a + Number(b.ingresotunel_total), 0);
    const total_basura = ingresos.reduce((a, b) => a + Number(b.ingresotunel_basura), 0);
    const rendimiento = total_libras > 0 ? ((total_libras - total_basura) / total_libras) * 100 : 0;

    await conmysql.query(`
      UPDATE liquidacion
      SET liquidacion_rendimiento = ?, liquidacion_basura = ?
      WHERE liquidacion_id = ?
    `, [rendimiento, total_basura, liquidacion_id]);

    return res.json({ liquidacion_id, totales: { total_libras, total_basura, rendimiento } });

  } catch (error) {
    console.error("Error en postLiquidacion:", error);
    return res.status(500).json({ message: "Error interno", error: error.message });
  }
};

// PUT: Update completa
export const putLiquidacion = async (req, res) => {
  try {
    const { id } = req.params;
    const { liquidacion_tipo } = req.body;

    // Recalcular totales desde IngresoTunel
    const [ingresos] = await conmysql.query(`
      SELECT ingresotunel_total, ingresotunel_basura
      FROM ingresotunel
      WHERE liquidacion_id = ?
    `, [id]);

    if (ingresos.length === 0) return res.status(404).json({ message: "Liquidación sin ingresos" });

    const total_libras = ingresos.reduce((a, b) => a + Number(b.ingresotunel_total), 0);
    const total_basura = ingresos.reduce((a, b) => a + Number(b.ingresotunel_basura), 0);
    const rendimiento = total_libras > 0 ? ((total_libras - total_basura) / total_libras) * 100 : 0;

    await conmysql.query(`
      UPDATE liquidacion
      SET liquidacion_tipo=?, liquidacion_rendimiento=?, liquidacion_basura=?
      WHERE liquidacion_id=?
    `, [liquidacion_tipo, rendimiento, total_basura, id]);

    const [rows] = await conmysql.query('SELECT * FROM liquidacion WHERE liquidacion_id=?', [id]);
    res.json(rows[0]);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// PATCH: Partial update
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

// DELETE: Eliminar liquidación
export const deleteLiquidacion = async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Desvincular ingresos
    await conmysql.query('UPDATE ingresotunel SET liquidacion_id = NULL WHERE liquidacion_id = ?', [id]);

    // 2. Eliminar liquidación
    await conmysql.query('DELETE FROM liquidacion WHERE liquidacion_id = ?', [id]);

    res.status(202).json({ message: "Liquidación eliminada con éxito" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
