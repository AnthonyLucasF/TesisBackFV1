// src/routes/orden.routes.js
import { Router } from "express";
import { getOrden, getOrdenxid, getOrdenesPendientes, postOrden, putOrden, deleteOrden } from '../controladores/ordenCtrl.js'

const router = Router()

// Rutas para orden
router.get('/orden', getOrden)
router.get('/orden/:id', getOrdenxid)
router.get('/orden/pendientes', getOrdenesPendientes) // ?talla_id=1
router.post('/orden', postOrden)
router.put('/orden/:id', putOrden)
router.delete('/orden/:id', deleteOrden)

export default router