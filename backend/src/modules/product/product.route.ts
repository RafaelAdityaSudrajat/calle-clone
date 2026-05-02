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
  getProductById,
  getProducts,
  updateProduct,
  uploadImages,
} from "./product.controller";

const router = Router();

router.post("/", authenticate, createProduct);
router.patch("/:id", authenticate, updateProduct);
router.get("/", getProducts);
router.get("/:id", getProductById);
router.delete('/:id', authenticate, deleteProduct);

router.post(
  "/:productId/images",
  authenticate,
  ensureMultipartFormData,
  upload.fields(productImageUploadFields),
  uploadImages,
);

export default router;
