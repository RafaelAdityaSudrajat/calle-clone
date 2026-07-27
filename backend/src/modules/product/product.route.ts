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
  getAdminProductById,
  getAdminProducts,
  getProductById,
  getProductForOrderHistory,
  getProducts,
  getPublicProductBySlug,
  getPublicProducts,
  updateProduct,
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

// get products public
router.get("/", getPublicProducts);
router.get("/:slug", getPublicProductBySlug);
router.get("/history/:id", authenticate, getProductForOrderHistory);

router.get('/admin', getAdminProducts);
router.get('/admin/:id', getAdminProductById);

// update product
router.patch("/:id", authenticate, updateProduct);

// delete product
router.delete("/:id", authenticate, deleteProduct);

// update images product
router.post(
  "/:productId/images",
  authenticate,
  ensureMultipartFormData,
  upload.fields(productImageUploadFields),
  uploadImages,
);

export default router;
