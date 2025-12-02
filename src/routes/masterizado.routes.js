// src/routes/masterizado.routes.js
import { Router } from "express";
import {
  getMasterizado,
  getMasterizadoxid,
  postMasterizado,
  putMasterizado,
  deleteMasterizado,
} from "../controladores/masterizadoCtrl.js";

const router = Router();

// Rutas para masterizado
router.get("/masterizado", getMasterizado);
router.get("/masterizado/:id", getMasterizadoxid);
router.post("/masterizado", postMasterizado);
router.put("/masterizado/:id", putMasterizado);
router.delete("/masterizado/:id", deleteMasterizado);

export default router;
