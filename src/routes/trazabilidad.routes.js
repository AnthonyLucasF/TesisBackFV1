// src/routes/trazabilidad.routes.js
import { Router } from "express";
import { getHistorialLote } from "../controladores/trazabilidadCtrl.js";

const router = Router();

// Obtener toda la trazabilidad del lote
router.get("/trazabilidad/:lote_id", getHistorialLote);

export default router;
