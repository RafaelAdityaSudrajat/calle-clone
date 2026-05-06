import { Request, Response, NextFunction } from "express";
import { AuthRequest } from "../../middlewares/authenticate";
import { createCategorySchema } from "./category.validation";
import {
  createCategoryService,
  getCategoriesService,
  getCategoryByIdService,
  updateCategoryService,
  deleteCategoryService,
} from "./category.service";
import { ValidationError } from "../../lib/errors";

export const createCategory = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const parsed = createCategorySchema.safeParse(req.body);

    if (!parsed.success) {
      const message = parsed.error.issues[0].message;
      throw new ValidationError(message);
    }

    const result = await createCategoryService(parsed.data);

    res.status(201).json({
      status: "success",
      message: "Category created successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};


export const getCategories = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await getCategoriesService();
    res.status(200).json({ status: 'success', data: result });
  } catch (error) {
    next(error);
  }
};

export const getCategoryById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await getCategoryByIdService(req.params.id);
    res.status(200).json({ status: 'success', data: result });
  } catch (error) {
    next(error);
  }
};

export const updateCategory = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const parsed = createCategorySchema.safeParse(req.body);

    if (!parsed.success) {
      const message = parsed.error.issues[0].message;
      throw new ValidationError(message);
    }

    const result = await updateCategoryService(req.params.id, parsed.data);
    res.status(200).json({
      status: 'success',
      message: 'Category updated successfully',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteCategory = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await deleteCategoryService(req.params.id);
    res.status(200).json({
      status: 'success',
      message: 'Category deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};