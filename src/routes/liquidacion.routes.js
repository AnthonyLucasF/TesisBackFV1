/* import { Router } from "express";
import { getLiquidacion, getLiquidacionxid, getLiquidacionDetalle, postLiquidacion, putLiquidacion, patchLiquidacion, deleteLiquidacion } from '../controladores/liquidacionCtrl.js'

const router = Router()

// Rutas para liquidacion
router.get('/liquidacion', getLiquidacion) // ?tipo=entero or cola
router.get('/liquidacion/:id', getLiquidacionxid)
router.get('/liquidacion/detalle/:liquidacion_id', getLiquidacionDetalle) // New
router.post('/liquidacion', postLiquidacion)
router.put('/liquidacion/:id', putLiquidacion)
router.patch('/liquidacion/:id', patchLiquidacion)
router.delete('/liquidacion/:id', deleteLiquidacion)

export default router */

import { Router } from "express";
import {
  generarLiquidacion,
  //listarLiquidaciones,
  //obtenerLiquidacionCompleta,
  //eliminarLiquidacion
} from "../controladores/liquidacionCtrl.js";

const router = Router();

router.post("/", generarLiquidacion);
//router.get("/", listarLiquidaciones);
//router.get("/:id", obtenerLiquidacionCompleta);
//router.delete("/:id", eliminarLiquidacion);

export default router;
