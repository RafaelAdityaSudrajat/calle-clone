import { Request, Response, NextFunction } from "express";
import { AuthRequest } from "../../middlewares/authenticate";
import {
  CategoryIdParamsInput,
  CreateCategoryInput,
  createCategorySchema,
  UpdateCategoryInput,
} from "./category.schema";
import {
  createCategoryService,
  getCategoryByIdService,
  updateCategoryService,
  deleteCategoryService,
  getCategoryService,
} from "./category.service";
import { UnauthorizedError, ValidationError } from "../../lib/errors";
import catchAsync from "../../lib/catchAsync";

export const createCategoryController = catchAsync(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const userId = req.auth?.userId;
    const input = req.body as CreateCategoryInput;

    if (!userId) {
      throw new UnauthorizedError("Silakan login terlebih dahulu");
    }

    const data = await createCategoryService(input);

    res.status(201).json({
      success: true,
      message: "Product created successfully",
      data,
    });
  },
);

export const getCategoryController = catchAsync(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const userId = req.auth?.userId;

    if (!userId) {
      throw new UnauthorizedError("Silakan login terlebih dahulu");
    }

    const data = await getCategoryService();

    res.status(200).json({
      success: true,
      message: "Categorys retrieved successfully",
      data,
    });
  },
);

export const getCategoryByIdController = catchAsync(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const userId = req.auth?.userId;
    const { id } = req.params as unknown as CategoryIdParamsInput;

    if (!userId) {
      throw new UnauthorizedError("Silakan login terlebih dahulu");
    }

    const data = await getCategoryByIdService(id);

    res.status(200).json({
      success: true,
      message: "Category retrieved successfully",
      data,
    });
  },
);

export const updateCategoryController = catchAsync(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const userId = req.auth?.userId;
    const input = req.body as UpdateCategoryInput;
    const { id } = req.params as unknown as CategoryIdParamsInput;

    if (!userId) {
      throw new UnauthorizedError("Silakan login terlebih dahulu");
    }

    const data = await updateCategoryService(id, input);

    res.status(200).json({
      success: true,
      message: "Category updated successfully",
      data,
    });
  },
);

export const deleteCategoryController = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params as unknown as CategoryIdParamsInput;
    const userId = req.auth?.userId;

    if (!userId) {
      throw new UnauthorizedError("Silakan login terlebih dahulu");
    }

    await deleteCategoryService(id);

    res.status(200).json({
      success: true,
      message: "Category deleted successfully",
      data: null,
    });
  },
);
