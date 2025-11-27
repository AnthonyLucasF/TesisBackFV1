import { Router } from "express";
import { getMasterizado, getMasterizadoxid, postMasterizado, putMasterizado, pathMasterizado, deleteMasterizado } from '../controladores/masterizadoCtrl.js'

const router = Router()

// Rutas para masterizado
router.get('/masterizado', getMasterizado)
router.get('/masterizado/:id', getMasterizadoxid)
router.post('/masterizado', postMasterizado)
router.put('/masterizado/:id', putMasterizado)
router.patch('/masterizado/:id', pathMasterizado)
router.delete('/masterizado/:id', deleteMasterizado)

export default router