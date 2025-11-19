// src/routes/ingresotunel.routes.js
import { Router } from "express";
import { getIngresoTunel, getIngresoTunelxid, postIngresoTunel, putIngresoTunel, deleteIngresoTunel } from '../controladores/ingresotunelCtrl.js'

const router = Router()

// Rutas para ingresotunel
router.get('/ingresotunel', getIngresoTunel)
router.get('/ingresotunel/:id', getIngresoTunelxid)
router.post('/ingresotunel', postIngresoTunel)
router.put('/ingresotunel/:id', putIngresoTunel)
//router.patch('/ingresotunel/:id', pathIngresoTunel)
router.delete('/ingresotunel/:id', deleteIngresoTunel)

//router.get('/ingresotunel/rendimiento', getRendimientoLote) // ?lote_id=1

export default router