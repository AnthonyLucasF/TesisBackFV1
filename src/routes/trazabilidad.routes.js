// src/routes/trazabilidad.routes.js
import { Router } from "express";
import { getHistorialCompleto } from "../controladores/trazabilidadCtrl.js";

const router = Router();

router.get("/trazabilidad/:lote_id", getHistorialCompleto);

export default router;

