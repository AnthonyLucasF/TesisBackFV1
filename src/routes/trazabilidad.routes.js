// src/rutas/trazabilidadRutas.js
import { Router } from "express";
import {
  getHistorialLote,
  getHistorialPorCodigo
} from "../controladores/trazabilidadCtrl.js";

const router = Router();

// Busca por ID de lote (dos rutas para que funcione con tu service actual)
router.get("/trazabilidad/:lote_id", getHistorialLote);
router.get("/trazabilidad/id/:lote_id", getHistorialLote);

// Busca por CÓDIGO (C-006-2025, etc.)
router.get("/trazabilidad/codigo/:codigo", getHistorialPorCodigo);

export default router;
