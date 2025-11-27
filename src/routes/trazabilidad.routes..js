// src/routes/trazabilidad.routes.js
import { Router } from "express";
import { getHistorialLote } from '../controladores/trazabilidadCtrl.js';

const router = Router();

router.get('/trazabilidad', getHistorialLote);  // ?query=codigo or id

export default router;