import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate";
import {
  createCategoryController,
  getCategoryController,
  getCategoryByIdController,
  updateCategoryController,
  deleteCategoryController,
} from "./category.controller";
import { requireAdmin } from "../../middlewares/requireAdmin";
import { validate } from "../../middlewares/validate";
import {
  categoryIdParamsConfig,
  createCategoryConfig,
  updateCategoryConfig,
} from "./category.schema";

const router = Router();

router.get("/", authenticate, requireAdmin, getCategoryController);
router.get(
  "/:id",
  authenticate,
  requireAdmin,
  validate(categoryIdParamsConfig),
  getCategoryByIdController,
);
router.post(
  "/",
  authenticate,
  requireAdmin,
  validate(createCategoryConfig),
  createCategoryController,
);
router.patch(
  "/:id",
  authenticate,
  requireAdmin,
  validate(categoryIdParamsConfig),
  validate(updateCategoryConfig),
  updateCategoryController,
);
router.delete(
  "/:id",
  authenticate,
  requireAdmin,
  validate(categoryIdParamsConfig),
  deleteCategoryController,
);

export default router;
