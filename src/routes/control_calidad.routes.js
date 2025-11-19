import { Router } from "express";
import { getControlCalidad, getControl_Calidadxid, postControl_Calidad, putControl_Calidad, pathControl_Calidad, deleteControl_Calidad } from '../controladores/control_calidadCtrl.js'

const router = Router()

//Armar nuestras rutas
router.get('/control_calidad', getControlCalidad) //SELECT
router.get('/control_calidad/:id', getControl_Calidadxid) //SELECT x ID
router.post('/control_calidad', postControl_Calidad) //INSERT
router.put('/control_calidad/:id', putControl_Calidad) //UPDATE
router.patch('/control_calidad/:id', pathControl_Calidad) //UPDATE
router.delete('/control_calidad/:id', deleteControl_Calidad) //DELETE

export default router