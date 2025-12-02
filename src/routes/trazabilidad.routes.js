// src/rutas/trazabilidadRutas.js
import { Router } from "express";
import {
  getHistorialLote,
  getHistorialLotePorCodigo
} from "../controladores/trazabilidadCtrl.js";

const router = Router();

// Buscar por ID de lote
// Coincide con: this.http.get(URLAPI + 'trazabilidad/id/' + lote_id)
router.get("/trazabilidad/id/:lote_id", getHistorialLote);

// (Opcional) soporte extra: /trazabilidad/:lote_id
// por si haces pruebas directas desde el navegador
router.get("/trazabilidad/:lote_id", getHistorialLote);

// Buscar por CÓDIGO de lote
// Coincide con: this.http.get(URLAPI + 'trazabilidad/codigo/' + codigo)
router.get("/trazabilidad/codigo/:codigo", getHistorialLotePorCodigo);

export default router;
