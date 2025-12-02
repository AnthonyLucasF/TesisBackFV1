// src/rutas/trazabilidadRutas.js
import { Router } from "express";
import {
  getHistorialLote,
  getListadoGeneralHistorial
} from "../controladores/trazabilidadCtrl.js";

const router = Router();

router.get("/trazabilidad/listado-general", getListadoGeneralHistorial);
router.get("/trazabilidad/id/:lote_id", getHistorialLote);

export default router;
