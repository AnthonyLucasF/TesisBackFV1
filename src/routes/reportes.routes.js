import { Router } from "express";
import { getHistorialLote } from '../controladores/reportesCtrl.js'

const router = Router()

//Armar nuestras rutas
router.get('/clase', getHistorialLote) //SELECT

export default router