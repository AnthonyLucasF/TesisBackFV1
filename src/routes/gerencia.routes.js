import { Router } from "express";
import { getGerencia } from '../controladores/gerenciaCtrl.js'

const router = Router()

//Armar nuestras rutas
router.get('/clase', getGerencia) //SELECT

export default router