import { Router } from "express";
import { getIngresoTunel, getIngresoTunelPorLote, getIngresoTunelxid, postIngresoTunel, putIngresoTunel, deleteIngresoTunel } from '../controladores/ingresotunelCtrl.js'

const router = Router()

router.get('/ingresotunel', getIngresoTunel)
router.get('/ingresotunel/porlote/:lote_id', getIngresoTunelPorLote)
router.get('/ingresotunel/:id', getIngresoTunelxid)
router.post('/ingresotunel', postIngresoTunel)
router.put('/ingresotunel/:id', putIngresoTunel)
router.delete('/ingresotunel/:id', deleteIngresoTunel)

export default router