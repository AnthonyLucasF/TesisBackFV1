import { conmysql } from "../db.js";

// GET: Obtener liquidaciones por tipo (entero/cola)
export const getLiquidacion = async (req, res) => {
  try {
    const { tipo } = req.query;
    const whereClause = tipo ? 'WHERE liquidacion_tipo = ?' : '';
    const [result] = await conmysql.query(
      `SELECT * FROM liquidacion ${whereClause} ORDER BY liquidacion_fecha DESC`,
      tipo ? [tipo] : []
    );

    // Convertir totales a números para Angular
    const formatted = result.map(l => ({
      ...l,
      liquidacion_rendimiento: Number(l.liquidacion_rendimiento || 0),
      liquidacion_basura: Number(l.liquidacion_basura || 0)
    }));

    res.json(formatted);
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
    if (result.length === 0)
      return res.status(404).json({ liquidacion_id: 0, message: "Liquidación no encontrada" });

    const l = result[0];
    l.liquidacion_rendimiento = Number(l.liquidacion_rendimiento || 0);
    l.liquidacion_basura = Number(l.liquidacion_basura || 0);

    res.json(l);
  } catch (error) {
    return res.status(500).json({ message: "Error del Servidor", error: error.message });
  }
};

// GET detalles por liquidacion_id
export const getLiquidacionDetalle = async (req, res) => {
  try {
    const { liquidacion_id } = req.params;

    const [detalle] = await conmysql.query(`
      SELECT 
        i.talla_id,
        i.orden_id,
        i.presentacion_id,
        ta.talla_descripcion,
        o.orden_descripcion,
        p.presentacion_descripcion,
        SUM(i.ingresotunel_total) AS total_libras,
        SUM(i.ingresotunel_basura) AS total_basura,
        SUM(i.ingresotunel_sobrante) AS total_sobrante,
        CASE 
          WHEN SUM(i.ingresotunel_total) > 0 
          THEN ((SUM(i.ingresotunel_total) - SUM(i.ingresotunel_basura)) / SUM(i.ingresotunel_total)) * 100
          ELSE 0
        END AS rendimiento
      FROM ingresotunel i
      LEFT JOIN talla ta ON i.talla_id = ta.talla_id
      LEFT JOIN orden o ON i.orden_id = o.orden_id
      LEFT JOIN presentacion p ON i.presentacion_id = p.presentacion_id
      WHERE i.liquidacion_id = ?
      GROUP BY i.talla_id, i.orden_id, i.presentacion_id, ta.talla_descripcion, o.orden_descripcion, p.presentacion_descripcion
      ORDER BY ta.talla_descripcion, o.orden_descripcion, p.presentacion_descripcion
    `, [liquidacion_id]);

    // Convertir a números
    const formatted = detalle.map(d => ({
      ...d,
      total_libras: Number(d.total_libras || 0),
      total_basura: Number(d.total_basura || 0),
      total_sobrante: Number(d.total_sobrante || 0),
      rendimiento: Number(d.rendimiento || 0)
    }));

    res.json(formatted);

  } catch (error) {
    return res.status(500).json({ message: "Error al consultar detalles agrupados", error: error.message });
  }
};

// POST: Crear liquidación
export const postLiquidacion = async (req, res) => {
  const { lote_id, tipo_id } = req.body;

  if (!lote_id || !tipo_id) {
    return res.status(400).json({ message: "lote_id y tipo_id son obligatorios" });
  }

  // Convertir tipo_id a string para el enum de la tabla
  const tipoStr = tipo_id === 1 ? 'entero' : 'cola';

  try {
    // Crear liquidación
    const [result] = await conmysql.query(`
      INSERT INTO liquidacion (lote_id, liquidacion_tipo, liquidacion_fecha)
      VALUES (?, ?, NOW())
    `, [lote_id, tipoStr]);

    const liquidacion_id = result.insertId;

    // Obtener ingresos del lote según tipo_id
    const [ingresos] = await conmysql.query(`
      SELECT i.ingresotunel_id, i.ingresotunel_total, i.ingresotunel_sobrante, i.ingresotunel_basura,
             i.talla_id, i.orden_id, i.presentacion_id, i.peso_id
      FROM ingresotunel i
      WHERE i.lote_id = ? AND i.tipo_id = ?
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

    // Calcular totales
    const total_libras = ingresos.reduce((a, b) => a + Number(b.ingresotunel_total || 0), 0);
    const total_basura = ingresos.reduce((a, b) => a + Number(b.ingresotunel_basura || 0), 0);
    const rendimiento = total_libras > 0 ? ((total_libras - total_basura) / total_libras) * 100 : 0;

    await conmysql.query(`
      UPDATE liquidacion
      SET liquidacion_rendimiento = ?, liquidacion_basura = ?
      WHERE liquidacion_id = ?
    `, [rendimiento, total_basura, liquidacion_id]);

    return res.json({
      liquidacion_id,
      lote_id,
      tipo: tipoStr,
      totales: { total_libras, total_basura, rendimiento },
      ingresos: ingresos.map(i => i.ingresotunel_id)
    });

  } catch (error) {
    console.error("Error en postLiquidacion:", error);
    return res.status(500).json({ message: "Error interno", error: error.message });
  }
};

// PUT: Actualizar liquidación completa
export const putLiquidacion = async (req, res) => {
  try {
    const { id } = req.params;
    const { liquidacion_tipo } = req.body;

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

// PATCH: Actualización parcial
export const patchLiquidacion = async (req, res) => {
  try {
    const { id } = req.params;
    const fields = Object.keys(req.body);
    if (fields.length === 0) return res.status(400).json({ message: "No fields to update" });

    const setClause = fields.map(f => `${f} = ?`).join(', ');
    const values = fields.map(f => req.body[f]);

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

    await conmysql.query('UPDATE ingresotunel SET liquidacion_id = NULL WHERE liquidacion_id = ?', [id]);
    await conmysql.query('DELETE FROM liquidacion WHERE liquidacion_id = ?', [id]);

    res.status(202).json({ message: "Liquidación eliminada con éxito" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
