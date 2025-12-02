// src/routes/trazabilidad.routes.js
import { Router } from "express";
import { getHistorialLote, getHistorialPorCodigo } from '../controladores/trazabilidadCtrl.js';

const router = Router();

// Buscar por ID del lote
router.get('/trazabilidad/:lote_id', getHistorialLote);

// Buscar por CÓDIGO del lote
router.get('/trazabilidad/codigo/:codigo', getHistorialPorCodigo);

export default router;
