import { Router } from "express";
import { getReporte } from '../controladores/reportesCtrl.js'

const router = Router()

//Armar nuestras rutas
router.get('/clase', getReporte) //SELECT

export default router