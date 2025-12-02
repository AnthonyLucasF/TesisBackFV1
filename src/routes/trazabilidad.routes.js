// src/routes/trazabilidad.routes.js
import { Router } from "express";
import {
  getHistorialLote,
  getHistorialPorCodigo
} from '../controladores/trazabilidadCtrl.js';

const router = Router();

// 🔹 Buscar por CÓDIGO (ej: C-006) – esta primero para que no haya conflictos
router.get('/trazabilidad/codigo/:codigo', getHistorialPorCodigo);

// 🔹 Buscar por ID del lote (numérico)
router.get('/trazabilidad/id/:lote_id', getHistorialLote);

export default router;
