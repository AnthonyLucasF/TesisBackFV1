// src/routes/pelado.routes.js
import { Router } from "express";
import { getPelado, getPeladoxid, postPelado, putPelado, pathPelado, deletePelado } from '../controladores/peladoCtrl.js'

const router = Router()

// Rutas para pelado
router.get('/pelado', getPelado)
router.get('/pelado/:id', getPeladoxid)
router.post('/pelado', postPelado)
router.put('/pelado/:id', putPelado)
router.patch('/pelado/:id', pathPelado)
router.delete('/pelado/:id', deletePelado)

export default router