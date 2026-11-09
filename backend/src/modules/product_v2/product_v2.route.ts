import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate";
import {
  createProductSchema,
  createVariantSchema,
  getProductDetailParams,
  getProductDetailQuery,
  listProductsParamsQuerySchema,
  listVariantsQuery,
  updateVariantBodyConfig,
  updateVariantParamsConfig,
  updateProductBody,
  updateProductParams,
  updateVariantConfig,
  imageParamsConfig,
} from "./product_v2.schema";
import { validate } from "../../middlewares/validate";
import {
  createProductController,
  createVariantController,
  deleteImageController,
  getListController,
  getProductDetailController,
  listLowStockVariantsController,
  listVariantController,
  publishProductController,
  republishProductController,
  setPrimaryImageController,
  softDeleteProductController,
  softDeleteVariantController,
  unpublishProductController,
  updateProductController,
  updateStockController,
  updateVariantController,
  uploadImageController,
} from "./product_v2.controller";
import { requireAdmin } from "../../middlewares/requireAdmin";
import { imageUpload } from "../../shared/storage";

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
  "/low-stock",
  authenticate,
  requireAdmin,
  listLowStockVariantsController,
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

router.get(
  "/:id/variants",
  authenticate,
  requireAdmin,
  validate(getProductDetailParams),
  validate(listVariantsQuery),
  listVariantController,
);

router.put(
  "/:productId/variants/:variantId",
  authenticate,
  requireAdmin,
  validate(updateVariantParamsConfig),
  validate(updateVariantBodyConfig),
  updateVariantController,
);

router.delete(
  "/:productId/variants/:variantId",
  authenticate,
  requireAdmin,
  validate(updateVariantParamsConfig),
  softDeleteVariantController,
);

router.patch(
  "/:productId/variants/:variantId/stock",
  authenticate,
  requireAdmin,
  validate(updateVariantParamsConfig),
  validate(updateVariantConfig),
  updateStockController,
);

router.post(
  "/:id/images",
  authenticate,
  requireAdmin,
  validate(getProductDetailParams),
  imageUpload,
  uploadImageController,
);

router.patch(
  "/:id/images/:imageId/primary",
  authenticate,
  requireAdmin,
  validate(imageParamsConfig),
  setPrimaryImageController,
);

router.delete(
  "/:id/images/:imageId",
  authenticate,
  requireAdmin,
  validate(imageParamsConfig),
  deleteImageController,
);

export default router;
