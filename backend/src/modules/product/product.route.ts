import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate";
import {
  ensureMultipartFormData,
  productImageUploadFields,
  upload,
} from "../../middlewares/upload";
import {
  createProduct,
  deleteProduct,
  deleteProductVariant,
  getAdminProductById,
  getAdminProducts,
  getProductForOrderHistory,
  getPublicProductBySlug,
  getPublicProducts,
  updateProduct,
  updateProductVariant,
  uploadImages,
} from "./product.controller";
import { handleProductImageUpload } from "./product.middleware";

const router = Router();

// create product
router.post(
  "/",
  authenticate,
  ensureMultipartFormData,
  upload.fields(productImageUploadFields),
  handleProductImageUpload,
  createProduct,
);

// GET PRODUCT PUBLIC
router.get("/", getPublicProducts);
router.get("/:slug", getPublicProductBySlug);
router.get("/history/:id", authenticate, getProductForOrderHistory);

// GET PRODUCT ADMIN
router.get('/admin', getAdminProducts);
router.get('/admin/:id', getAdminProductById);

// UPDATE PRODUCT
router.patch("/:id", authenticate, updateProduct);

// UPDATE PRODUCT VARINATS
router.patch("/variants/:id", authenticate, updateProductVariant);


// DELETE PRODUCT
router.delete("/:id", authenticate, deleteProduct);

//DELETE PRODUCT VARIANT
router.delete("/variants/:id", authenticate, deleteProductVariant);

// update images product
router.post(
  "/:productId/images",
  authenticate,
  ensureMultipartFormData,
  upload.fields(productImageUploadFields),
  uploadImages,
);

export default router;
