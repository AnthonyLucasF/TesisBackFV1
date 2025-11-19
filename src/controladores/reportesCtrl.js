import { conmysql } from "../db.js";

// GET historial lote (básico, directo desde DB)
export const getHistorialLote = async (req, res) => {
  try {
    const { lote_id } = req.params;

    const [rows] = await conmysql.query(
      'SELECT lote_historial FROM lote WHERE lote_id = ?',
      [lote_id]
    );

    if (!rows.length)
      return res.status(404).json({ message: 'Lote no encontrado' });

    const historial = rows[0].lote_historial
      ? JSON.parse(rows[0].lote_historial)
      : { etapas: [] };

    res.json(historial);

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
