import { conmysql } from "../db.js";

export const getHistorialCompleto = async (req, res) => {
  try {
    const { lote_id } = req.params;

    // 1. RECEPCIÓN
    const [recep] = await conmysql.query(`
      SELECT lote_codigo, lote_libras_remitidas, lote_n_bines, lote_n_piscina,
             (lote_libras_remitidas / lote_n_bines) AS peso_promedio,
             proveedor_nombre, lote_fecha
      FROM lote
      JOIN proveedor ON proveedor.proveedor_id = lote.proveedor_id
      WHERE lote_id = ?`, [lote_id]);

    // 2. CALIDAD
    const [cal] = await conmysql.query(`
      SELECT defectos_total_defectos AS total_defectos,
             defectos_basura AS basura,
             defectos_observaciones AS obs,
             defectos_acciones_correctivas AS acciones,
             defectos_fecha AS fecha
      FROM defectos WHERE lote_id = ? LIMIT 1`, [lote_id]);

    // 3. CLASIFICACIÓN
    const [clas] = await conmysql.query(`
      SELECT COUNT(*) AS coches,
             SUM(ingresotunel_total) AS libras,
             SUM(ingresotunel_basura) AS basura,
             ingresotunel_fecha AS fecha
      FROM ingresotunel WHERE lote_id = ?`, [lote_id]);

    // 4. INGRESO A TÚNEL → por tipo
    const [tunelEntero] = await conmysql.query(`
      SELECT COUNT(*) AS coches, SUM(ingresotunel_total) AS libras,
             SUM(ingresotunel_basura) AS basura
      FROM ingresotunel WHERE lote_id = ? AND tipo_id = 1`, [lote_id]);

    const [tunelCola] = await conmysql.query(`
      SELECT COUNT(*) AS coches, SUM(ingresotunel_total) AS libras,
             SUM(ingresotunel_basura) AS basura
      FROM ingresotunel WHERE lote_id = ? AND tipo_id = 2`, [lote_id]);

    // 5. MASTERIZADO
    const [master] = await conmysql.query(`
      SELECT SUM(master_total_libras) AS libras,
             SUM(master_total_cajas) AS cajas,
             SUM(master_cantidad) AS masters
      FROM masterizado WHERE lote_id = ?`, [lote_id]);

    // 6. LIQUIDACIÓN
    const [liq] = await conmysql.query(`
      SELECT liquidacion_id, liquidacion_total_libras AS empacado,
             liquidacion_sobrante AS sobrante, liquidacion_basura AS basura,
             liquidacion_rendimiento AS rendimiento, liquidacion_fecha AS fecha,
             liquidacion_tipo
      FROM liquidacion WHERE lote_id = ?`, [lote_id]);

    return res.json({
      recepcion: recep[0] || {},
      calidad: cal[0] || {},
      clasificacion: clas[0] || {},
      tunel: {
        entero: tunelEntero[0] || {},
        cola: tunelCola[0] || {}
      },
      masterizado: master[0] || {},
      liquidacion: liq || []
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: err.message });
  }
};
