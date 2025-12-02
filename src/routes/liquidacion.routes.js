import { Router } from "express";
import {
  postLiquidacion,
  getLiquidaciones,
  getLiquidacionxid,
  //getLiquidacionDetalle,
  //deleteLiquidacion
} from "../controladores/liquidacionCtrl.js";

const router = Router();

router.post("/liquidacion", postLiquidacion);
router.get("/liquidacion", getLiquidaciones);
router.get("/liquidacion/:id", getLiquidacionxid);
//router.get("/liquidacion/detalle/:id", getLiquidacionDetalle);
//router.delete("/liquidacion/:id", deleteLiquidacion);

export default router;
