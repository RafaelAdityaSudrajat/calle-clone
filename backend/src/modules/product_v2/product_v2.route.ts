import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate";
import {
  createProductSchema,
  createVariantSchema,
  getProductDetailParams,
  getProductDetailQuery,
  listProductsParamsQuerySchema,
  updateProductBody,
  updateProductParams,
} from "./product_v2.schema";
import { validate } from "../../middlewares/validate";
import {
  createProductController,
  createVariantController,
  getListController,
  getProductDetailController,
  publishProductController,
  republishProductController,
  softDeleteProductController,
  unpublishProductController,
  updateProductController,
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

router.get(
  "/:id",
  authenticate,
  requireAdmin,
  validate(getProductDetailParams),
  validate(getProductDetailQuery),
  getProductDetailController,
);

router.put(
  "/:id",
  authenticate,
  requireAdmin,
  validate(updateProductParams),
  validate(updateProductBody),
  updateProductController,
);

router.delete(
  "/:id",
  authenticate,
  requireAdmin,
  validate(getProductDetailParams),
  softDeleteProductController,
);

router.post(
  "/:id/publish",
  authenticate,
  requireAdmin,
  validate(getProductDetailParams),
  publishProductController,
);

router.post(
  "/:id/republish",
  authenticate,
  requireAdmin,
  validate(getProductDetailParams),
  republishProductController,
);

router.post(
  "/:id/unpublish",
  authenticate,
  requireAdmin,
  validate(getProductDetailParams),
  unpublishProductController,
);

router.post(
  "/:id/variants",
  authenticate,
  requireAdmin,
  validate(getProductDetailParams),
  validate(createVariantSchema),
  createVariantController,
);

export default router;
