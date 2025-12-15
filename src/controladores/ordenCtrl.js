/* import { conmysql } from "../db.js";

//   GET: Todas las órdenes con talla, pendientes y sobrantes
export const getOrden = async (req, res) => {
  try {
    const [result] = await conmysql.query(`
      SELECT 
        o.*, 
        t.talla_descripcion,
        GREATEST(o.orden_total_libras - IFNULL(SUM(i.ingresotunel_total), 0), 0) AS orden_libras_pendientes,
        GREATEST(IFNULL(SUM(i.ingresotunel_total), 0) - o.orden_total_libras, 0) AS orden_libras_sobrantes
      FROM orden o
      LEFT JOIN talla t ON o.talla_id = t.talla_id
      LEFT JOIN ingresotunel i ON o.orden_id = i.orden_id
      GROUP BY o.orden_id
      ORDER BY o.orden_fecha_produccion DESC
    `);

    res.json(result);

  } catch (error) {
    res.status(500).json({ message: "Error al consultar Órdenes" });
  }
};

//   GET: Orden por ID con pendientes y sobrantes
export const getOrdenxid = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: "ID de orden inválido" });

    const [result] = await conmysql.query(`
      SELECT 
        o.*, 
        t.talla_descripcion,
        GREATEST(o.orden_total_libras - IFNULL(SUM(i.ingresotunel_total), 0), 0) AS orden_libras_pendientes,
        GREATEST(IFNULL(SUM(i.ingresotunel_total), 0) - o.orden_total_libras, 0) AS orden_libras_sobrantes
      FROM orden o
      LEFT JOIN talla t ON o.talla_id = t.talla_id
      LEFT JOIN ingresotunel i ON o.orden_id = i.orden_id
      WHERE o.orden_id = ?
      GROUP BY o.orden_id
    `, [id]);

    if (!result.length)
      return res.status(404).json({ orden_id: 0, message: "Orden no encontrada" });

    res.json(result[0]);

  } catch (error) {
    res.status(500).json({ message: "Error del Servidor" });
  }
};

//   GET: Órdenes pendientes por talla (solo las que faltan por empacar)
export const getOrdenesPendientes = async (req, res) => {
  try {
    const { talla_id } = req.query;
    if (!talla_id) return res.status(400).json({ message: "talla_id required" });

    const [result] = await conmysql.query(`
      SELECT 
        o.*, 
        t.talla_descripcion,
        GREATEST(o.orden_total_libras - IFNULL(SUM(i.ingresotunel_total), 0), 0) AS orden_libras_pendientes,
        GREATEST(IFNULL(SUM(i.ingresotunel_total), 0) - o.orden_total_libras, 0) AS orden_libras_sobrantes
      FROM orden o
      LEFT JOIN talla t ON o.talla_id = t.talla_id
      LEFT JOIN ingresotunel i ON o.orden_id = i.orden_id
      WHERE o.talla_id = ?
      GROUP BY o.orden_id
      HAVING orden_libras_pendientes > 0
      ORDER BY o.orden_fecha_produccion ASC
    `, [talla_id]);

    res.json(result);

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

//   POST: Crear orden (pendientes = total, sobrantes = 0)
export const postOrden = async (req, res) => {
  try {
    const {
      orden_codigo, orden_descripcion, orden_cliente, orden_lote_cliente,
      orden_fecha_produccion, orden_fecha_juliana, orden_talla_real,
      orden_talla_marcada, orden_microlote, orden_total_master,
      orden_total_libras, talla_id
    } = req.body;

    if (orden_total_libras == null || !talla_id)
      return res.status(400).json({ message: "orden_total_libras y talla_id requeridos" });

    const orden_libras_pendientes = orden_total_libras;
    const orden_libras_sobrantes = 0;
    const orden_estado = 'pendiente';

    const [insert] = await conmysql.query(
      `INSERT INTO orden (
        orden_codigo, orden_descripcion, orden_cliente, orden_lote_cliente,
        orden_fecha_produccion, orden_fecha_juliana, orden_talla_real, 
        orden_talla_marcada, orden_microlote, orden_total_master,
        orden_total_libras, orden_libras_pendientes, orden_libras_sobrantes,
        orden_estado, talla_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        orden_codigo, orden_descripcion, orden_cliente, orden_lote_cliente,
        orden_fecha_produccion, orden_fecha_juliana, orden_talla_real,
        orden_talla_marcada, orden_microlote, orden_total_master,
        orden_total_libras, orden_libras_pendientes, orden_libras_sobrantes,
        orden_estado, talla_id
      ]
    );

    const nuevoId = insert.insertId;
    const [nuevo] = await conmysql.query("SELECT * FROM orden WHERE orden_id = ?", [nuevoId]);

    global._io.emit("orden_nueva", nuevo[0]);

    res.json(nuevo[0]);

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// PUT: Actualizar orden con pendientes y sobrantes correctos
export const putOrden = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      orden_codigo,
      orden_descripcion,
      orden_cliente,
      orden_lote_cliente,
      orden_fecha_produccion,
      orden_fecha_juliana,
      orden_talla_real,
      orden_talla_marcada,
      orden_microlote,
      orden_total_master,
      orden_total_libras,
      talla_id
    } = req.body;

    // Validaciones básicas
    const totalMaster = Number(orden_total_master) || 0;
    const totalLibras = Number(orden_total_libras);
    const tallaId = Number(talla_id) || 0;

    if (isNaN(totalLibras) || totalLibras <= 0) {
      return res.status(400).json({ message: "orden_total_libras requerido y mayor a 0" });
    }
    if (tallaId <= 0) {
      return res.status(400).json({ message: "talla_id requerido y mayor a 0" });
    }

    // Manejo seguro de fechas
    const fechaProduccion = orden_fecha_produccion || null;
    const fechaJuliana = orden_fecha_juliana || null;

    // Obtener libras ya empacadas
    const [agg] = await conmysql.query(
      "SELECT IFNULL(SUM(ingresotunel_total), 0) AS empacadas FROM ingresotunel WHERE orden_id = ?",
      [id]
    );
    const empacadas = Number(agg[0].empacadas);

    // No permitir reducir total por debajo de lo empacado
    if (totalLibras < empacadas) {
      return res.status(400).json({
        message: `No puedes establecer ${totalLibras} libras porque ya existen ${empacadas} libras ingresadas`
      });
    }

    // Calcular pendientes y sobrantes
    let orden_libras_pendientes = totalLibras - empacadas;
    let orden_libras_sobrantes = 0;

    if (orden_libras_pendientes < 0) {
      orden_libras_sobrantes = Math.abs(orden_libras_pendientes);
      orden_libras_pendientes = 0;
    }

    const orden_estado = orden_libras_pendientes > 0 ? "pendiente" : "cumplida";

    // Actualizar orden en la DB
    const [update] = await conmysql.query(
      `UPDATE orden SET
         orden_codigo = ?,
         orden_descripcion = ?,
         orden_cliente = ?,
         orden_lote_cliente = ?,
         orden_fecha_produccion = ?,
         orden_fecha_juliana = ?,
         orden_talla_real = ?,
         orden_talla_marcada = ?,
         orden_microlote = ?,
         orden_total_master = ?,
         orden_total_libras = ?,
         orden_libras_pendientes = ?,
         orden_libras_sobrantes = ?,
         orden_estado = ?,
         talla_id = ?
       WHERE orden_id = ?`,
      [
        orden_codigo || null,
        orden_descripcion || null,
        orden_cliente || null,
        orden_lote_cliente || null,
        fechaProduccion,
        fechaJuliana,
        orden_talla_real || null,
        orden_talla_marcada || null,
        orden_microlote || null,
        totalMaster,
        totalLibras,
        orden_libras_pendientes,
        orden_libras_sobrantes,
        orden_estado,
        tallaId,
        id
      ]
    );

    if (!update.affectedRows) {
      return res.status(404).json({ message: "Orden no encontrada" });
    }

    // Obtener orden actualizada
    const [actualizado] = await conmysql.query("SELECT * FROM orden WHERE orden_id = ?", [id]);

    // Emitir eventos via sockets
    global._io.emit("orden_actualizada", actualizado[0]);
    if (orden_estado === "cumplida") global._io.emit("orden_cumplida", actualizado[0]);

    res.json(actualizado[0]);

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

//   DELETE: Eliminar orden y emitir evento
export const deleteOrden = async (req, res) => {
  try {
    const { id } = req.params;

    await conmysql.query("DELETE FROM orden WHERE orden_id = ?", [id]);

    global._io.emit("orden_eliminada", { orden_id: Number(id) });

    res.status(202).json({ message: "Orden eliminada con éxito" });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
 */


import { conmysql } from "../db.js";

/** Obtiene la descripción real de la talla según talla_id */
const getTallaDescripcionById = async (tallaId) => {
  const [rows] = await conmysql.query(
    "SELECT talla_descripcion FROM talla WHERE talla_id = ? LIMIT 1",
    [tallaId]
  );
  return rows.length ? rows[0].talla_descripcion : null;
};

// GET: Todas las órdenes con talla, pendientes y sobrantes (+ peso_id, glaseo_id ya vienen en o.*)
export const getOrden = async (req, res) => {
  try {
    const [result] = await conmysql.query(`
      SELECT 
        o.*, 
        t.talla_descripcion,
        GREATEST(o.orden_total_libras - IFNULL(SUM(i.ingresotunel_total), 0), 0) AS orden_libras_pendientes,
        GREATEST(IFNULL(SUM(i.ingresotunel_total), 0) - o.orden_total_libras, 0) AS orden_libras_sobrantes
      FROM orden o
      LEFT JOIN talla t ON o.talla_id = t.talla_id
      LEFT JOIN ingresotunel i ON o.orden_id = i.orden_id
      GROUP BY o.orden_id
      ORDER BY o.orden_fecha_produccion DESC
    `);

    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al consultar Órdenes" });
  }
};

// GET: Orden por ID con pendientes y sobrantes
export const getOrdenxid = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: "ID de orden inválido" });

    const [result] = await conmysql.query(
      `
      SELECT 
        o.*, 
        t.talla_descripcion,
        GREATEST(o.orden_total_libras - IFNULL(SUM(i.ingresotunel_total), 0), 0) AS orden_libras_pendientes,
        GREATEST(IFNULL(SUM(i.ingresotunel_total), 0) - o.orden_total_libras, 0) AS orden_libras_sobrantes
      FROM orden o
      LEFT JOIN talla t ON o.talla_id = t.talla_id
      LEFT JOIN ingresotunel i ON o.orden_id = i.orden_id
      WHERE o.orden_id = ?
      GROUP BY o.orden_id
      `,
      [id]
    );

    if (!result.length)
      return res.status(404).json({ orden_id: 0, message: "Orden no encontrada" });

    res.json(result[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error del Servidor" });
  }
};

// GET: Órdenes pendientes por talla (solo las que faltan por empacar)
export const getOrdenesPendientes = async (req, res) => {
  try {
    const { talla_id } = req.query;
    const tallaId = Number(talla_id);

    if (!tallaId) return res.status(400).json({ message: "talla_id required" });

    const [result] = await conmysql.query(
      `
      SELECT 
        o.*, 
        t.talla_descripcion,
        GREATEST(o.orden_total_libras - IFNULL(SUM(i.ingresotunel_total), 0), 0) AS orden_libras_pendientes,
        GREATEST(IFNULL(SUM(i.ingresotunel_total), 0) - o.orden_total_libras, 0) AS orden_libras_sobrantes
      FROM orden o
      LEFT JOIN talla t ON o.talla_id = t.talla_id
      LEFT JOIN ingresotunel i ON o.orden_id = i.orden_id
      WHERE o.talla_id = ?
      GROUP BY o.orden_id
      HAVING orden_libras_pendientes > 0
      ORDER BY o.orden_fecha_produccion ASC
      `,
      [tallaId]
    );

    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

// POST: Crear orden (pendientes = total, sobrantes = 0)
// + peso_id, glaseo_id
// + orden_talla_marcada se fuerza con la talla seleccionada
export const postOrden = async (req, res) => {
  try {
    const {
      orden_codigo,
      orden_descripcion,
      orden_cliente,
      orden_lote_cliente,
      orden_fecha_produccion,
      orden_fecha_juliana, // se mantiene (futura actualización)
      orden_talla_real,    // se mantiene
      orden_microlote,
      orden_total_master,
      orden_total_libras,
      talla_id,
      peso_id,
      glaseo_id
    } = req.body;

    if (orden_total_libras == null || !talla_id)
      return res.status(400).json({ message: "orden_total_libras y talla_id requeridos" });

    const tallaId = Number(talla_id) || 0;
    if (tallaId <= 0) return res.status(400).json({ message: "talla_id inválido" });

    // Forzar orden_talla_marcada según catálogo talla
    const tallaMarcada = await getTallaDescripcionById(tallaId);
    if (!tallaMarcada) return res.status(400).json({ message: "talla_id no existe" });

    const orden_libras_pendientes = Number(orden_total_libras);
    const orden_libras_sobrantes = 0;
    const orden_estado = "pendiente";

    const [insert] = await conmysql.query(
      `INSERT INTO orden (
        orden_codigo, orden_descripcion, orden_cliente, orden_lote_cliente,
        orden_fecha_produccion, orden_fecha_juliana, orden_talla_real, 
        orden_talla_marcada, orden_microlote, orden_total_master,
        orden_total_libras, orden_libras_pendientes, orden_libras_sobrantes,
        orden_estado, talla_id, peso_id, glaseo_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        orden_codigo || null,
        orden_descripcion || null,
        orden_cliente || null,
        orden_lote_cliente || null,
        orden_fecha_produccion || null,
        orden_fecha_juliana || null,
        orden_talla_real || null,
        tallaMarcada, // <- FORZADO
        orden_microlote || null,
        Number(orden_total_master) || 0,
        Number(orden_total_libras),
        orden_libras_pendientes,
        orden_libras_sobrantes,
        orden_estado,
        tallaId,
        peso_id != null && peso_id !== "" ? Number(peso_id) : null,
        glaseo_id != null && glaseo_id !== "" ? Number(glaseo_id) : null
      ]
    );

    const nuevoId = insert.insertId;

    // Devuelve lo creado con el mismo formato que tus GET (incluye cálculo y talla_descripcion)
    const [nuevo] = await conmysql.query(
      `
      SELECT 
        o.*, 
        t.talla_descripcion,
        GREATEST(o.orden_total_libras - IFNULL(SUM(i.ingresotunel_total), 0), 0) AS orden_libras_pendientes,
        GREATEST(IFNULL(SUM(i.ingresotunel_total), 0) - o.orden_total_libras, 0) AS orden_libras_sobrantes
      FROM orden o
      LEFT JOIN talla t ON o.talla_id = t.talla_id
      LEFT JOIN ingresotunel i ON o.orden_id = i.orden_id
      WHERE o.orden_id = ?
      GROUP BY o.orden_id
      `,
      [nuevoId]
    );

    global._io.emit("orden_nueva", nuevo[0]);

    res.json(nuevo[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

// PUT: Actualizar orden con pendientes y sobrantes correctos
// + peso_id, glaseo_id
// + orden_talla_marcada se fuerza con la talla seleccionada
export const putOrden = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      orden_codigo,
      orden_descripcion,
      orden_cliente,
      orden_lote_cliente,
      orden_fecha_produccion,
      orden_fecha_juliana, // se mantiene
      orden_talla_real,    // se mantiene
      orden_microlote,
      orden_total_master,
      orden_total_libras,
      talla_id,
      peso_id,
      glaseo_id
    } = req.body;

    // Validaciones básicas
    const totalMaster = Number(orden_total_master) || 0;
    const totalLibras = Number(orden_total_libras);
    const tallaId = Number(talla_id) || 0;

    if (isNaN(totalLibras) || totalLibras <= 0) {
      return res.status(400).json({ message: "orden_total_libras requerido y mayor a 0" });
    }
    if (tallaId <= 0) {
      return res.status(400).json({ message: "talla_id requerido y mayor a 0" });
    }

    // Manejo seguro de fechas
    const fechaProduccion = orden_fecha_produccion || null;
    const fechaJuliana = orden_fecha_juliana || null;

    // Obtener libras ya empacadas
    const [agg] = await conmysql.query(
      "SELECT IFNULL(SUM(ingresotunel_total), 0) AS empacadas FROM ingresotunel WHERE orden_id = ?",
      [id]
    );
    const empacadas = Number(agg[0].empacadas) || 0;

    // No permitir reducir total por debajo de lo empacado
    if (totalLibras < empacadas) {
      return res.status(400).json({
        message: `No puedes establecer ${totalLibras} libras porque ya existen ${empacadas} libras ingresadas`
      });
    }

    // Forzar orden_talla_marcada según catálogo talla
    const tallaMarcada = await getTallaDescripcionById(tallaId);
    if (!tallaMarcada) return res.status(400).json({ message: "talla_id no existe" });

    // Calcular pendientes y sobrantes
    let orden_libras_pendientes = totalLibras - empacadas;
    let orden_libras_sobrantes = 0;

    if (orden_libras_pendientes < 0) {
      orden_libras_sobrantes = Math.abs(orden_libras_pendientes);
      orden_libras_pendientes = 0;
    }

    const orden_estado = orden_libras_pendientes > 0 ? "pendiente" : "cumplida";

    // Actualizar orden en la DB
    const [update] = await conmysql.query(
      `UPDATE orden SET
         orden_codigo = ?,
         orden_descripcion = ?,
         orden_cliente = ?,
         orden_lote_cliente = ?,
         orden_fecha_produccion = ?,
         orden_fecha_juliana = ?,
         orden_talla_real = ?,
         orden_talla_marcada = ?,
         orden_microlote = ?,
         orden_total_master = ?,
         orden_total_libras = ?,
         orden_libras_pendientes = ?,
         orden_libras_sobrantes = ?,
         orden_estado = ?,
         talla_id = ?,
         peso_id = ?,
         glaseo_id = ?
       WHERE orden_id = ?`,
      [
        orden_codigo || null,
        orden_descripcion || null,
        orden_cliente || null,
        orden_lote_cliente || null,
        fechaProduccion,
        fechaJuliana,
        orden_talla_real || null,
        tallaMarcada, // <- FORZADO
        orden_microlote || null,
        totalMaster,
        totalLibras,
        orden_libras_pendientes,
        orden_libras_sobrantes,
        orden_estado,
        tallaId,
        peso_id != null && peso_id !== "" ? Number(peso_id) : null,
        glaseo_id != null && glaseo_id !== "" ? Number(glaseo_id) : null,
        id
      ]
    );

    if (!update.affectedRows) {
      return res.status(404).json({ message: "Orden no encontrada" });
    }

    // Obtener orden actualizada (con cálculos y talla_descripcion)
    const [actualizado] = await conmysql.query(
      `
      SELECT 
        o.*, 
        t.talla_descripcion,
        GREATEST(o.orden_total_libras - IFNULL(SUM(i.ingresotunel_total), 0), 0) AS orden_libras_pendientes,
        GREATEST(IFNULL(SUM(i.ingresotunel_total), 0) - o.orden_total_libras, 0) AS orden_libras_sobrantes
      FROM orden o
      LEFT JOIN talla t ON o.talla_id = t.talla_id
      LEFT JOIN ingresotunel i ON o.orden_id = i.orden_id
      WHERE o.orden_id = ?
      GROUP BY o.orden_id
      `,
      [id]
    );

    // Emitir eventos via sockets
    global._io.emit("orden_actualizada", actualizado[0]);
    if (orden_estado === "cumplida") global._io.emit("orden_cumplida", actualizado[0]);

    res.json(actualizado[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

// DELETE: Eliminar orden y emitir evento
export const deleteOrden = async (req, res) => {
  try {
    const { id } = req.params;

    await conmysql.query("DELETE FROM orden WHERE orden_id = ?", [id]);

    global._io.emit("orden_eliminada", { orden_id: Number(id) });

    res.status(202).json({ message: "Orden eliminada con éxito" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};
