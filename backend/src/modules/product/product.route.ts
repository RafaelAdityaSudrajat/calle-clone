import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate";
// import {
//   ensureMultipartFormData,
//   productImageUploadFields,
//   upload,
// } from "../../middlewares/upload";
import {
  createProductController,
  deleteProductController,
  deleteProductVariantController,
  getAdminProductByIdController,
  getAdminProductsController,
  getPublicProductBySlugController,
  getPublicProductsController,
  updateProductController,
  updateProductVariantController,
  uploadImagesController,
} from "./product.controller";
import { handleProductImageUpload } from "./product.middleware";
import { validate } from "../../middlewares/validate";
import { createProductSchema, updateProductSchema } from "./product.validation";
import { requireAdmin } from "../../middlewares/requireAdmin";

const router = Router();

// create product
// router.post(
//   "/",
//   authenticate,
//   ensureMultipartFormData,
//   upload.fields(productImageUploadFields),
//   handleProductImageUpload,
//   validate(createProductSchema),
//   createProductController,
// );

router.get("/admin", authenticate, requireAdmin, getAdminProductsController);
// GET PRODUCT PUBLIC
router.get("/", getPublicProductsController);

router.get(
  "/admin/:productId",
  authenticate,
  requireAdmin,
  getAdminProductByIdController,
);

router.get("/:slug", getPublicProductBySlugController);
// UPDATE PRODUCT
router.patch(
  "/:productId",
  authenticate,
  validate(updateProductSchema),
  updateProductController,
);
// UPDATE PRODUCT VARINATS
router.patch("/variants/:id", authenticate, updateProductVariantController);
// DELETE PRODUCT
router.delete("/:id", authenticate, requireAdmin, deleteProductController);
//DELETE PRODUCT VARIANT
router.delete(
  "/variants/:id",
  authenticate,
  requireAdmin,
  deleteProductVariantController,
);

// update images product
// router.post(
//   "/:productId/images",
//   authenticate,
//   ensureMultipartFormData,
//   upload.fields(productImageUploadFields),
//   uploadImagesController,
// );

export default router;
