// src/routes/reportes.routes.js
import { Router } from "express";
import { getReporte } from "../controladores/reportesCtrl.js";

const router = Router();

router.get("/reportes/:tipo", getReporte);

export default router;
