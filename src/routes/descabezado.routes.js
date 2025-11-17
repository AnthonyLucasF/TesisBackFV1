import { Router } from 'express';
import {
  getDescabezado,
  getDescabezadoxid,
  postDescabezado,
  putDescabezado,
  pathDescabezado,
  deleteDescabezado
} from '../controladores/descabezadoCtrl.js';
const router = Router();

router.get('/descabezado', getDescabezado);
router.get('/descabezado/:id', getDescabezadoxid);
router.post('/descabezado', postDescabezado);
router.put('/descabezado/:id', putDescabezado);
router.patch('/descabezado/:id', pathDescabezado);
router.delete('/descabezado/:id', deleteDescabezado);

export default router;