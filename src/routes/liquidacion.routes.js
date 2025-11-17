// src/routes/liquidacion.routes.js
import { Router } from "express";
import { getLiquidacion, getLiquidacionxid, postLiquidacion, putLiquidacion, pathLiquidacion, deleteLiquidacion } from '../controladores/liquidacionCtrl.js'

const router = Router()

// Rutas para liquidacion
router.get('/liquidacion', getLiquidacion) // ?tipo=entero or cola
router.get('/liquidacion/:id', getLiquidacionxid)
router.post('/liquidacion', postLiquidacion)
router.put('/liquidacion/:id', putLiquidacion)
router.patch('/liquidacion/:id', pathLiquidacion)
router.delete('/liquidacion/:id', deleteLiquidacion)

export default router