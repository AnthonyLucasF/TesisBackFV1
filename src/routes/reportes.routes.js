import { Router } from "express";
import { getHistorialLotexd } from '../controladores/reportesCtrl.js'

const router = Router()

//Armar nuestras rutas
router.get('/clase', getHistorialLotexd) //SELECT

export default router