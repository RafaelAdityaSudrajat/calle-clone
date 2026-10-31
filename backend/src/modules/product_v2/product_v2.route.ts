import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate";
import {
  createProductSchema,
  listProductsParamsQuerySchema,
} from "./product_v2.schema";
import { validate } from "../../middlewares/validate";
import {
  createProductController,
  getListController,
} from "./product_v2.controller";
import { requireAdmin } from "../../middlewares/requireAdmin";
import { listOrdersSchema } from "../order/order.schema";

const router = Router();

router.post(
  "/",
  authenticate,
  requireAdmin,
  validate(createProductSchema),
  createProductController,
);

router.get(
  "/",
  authenticate,
  requireAdmin,
  validate(listProductsParamsQuerySchema),
  getListController,
);

export default router;
