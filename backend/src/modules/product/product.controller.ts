import { Response, NextFunction, Request } from "express";
import { uploadProductImages } from "./product.service";
import { ValidationError } from "../../lib/errors";
import { AuthRequest } from "../../middlewares/authenticate";
import { normalizeUploadedFiles } from "../../middlewares/upload";
import { createProductSchema } from "./product.validation";
import { createProductService } from "./product.service";
import { getProductsQuerySchema } from "./product.validation";
import { getProductsService } from "./product.service";
import { getProductByIdService } from "./product.service";
import { updateProductSchema } from "./product.validation";
import { updateProductService } from "./product.service";
import { deleteProductService } from "./product.service";

type Params = {
  productId: string;
};

export const createProduct = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const parsed = createProductSchema.safeParse(req.body);

    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message || "Validation error";
      throw new ValidationError(message);
    }

    const result = await createProductService(parsed.data);

    res.status(201).json({
      status: "success",
      message: "Product created successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const updateProduct = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const parsed = updateProductSchema.safeParse(req.body);

    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message || "Validation error";
      throw new ValidationError(message);
    }

    const result = await updateProductService(req.params.id, parsed.data);

    res.status(200).json({
      status: "success",
      message: "Product updated successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getProducts = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const parsed = getProductsQuerySchema.safeParse(req.query);

    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message || "Validation error";
      throw new ValidationError(message);
    }

    const result = await getProductsService(parsed.data);

    res.status(200).json({
      status: "success",
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

export const getProductById = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const result = await getProductByIdService(req.params.id);

    res.status(200).json({
      status: "success",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteProduct = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    await deleteProductService(req.params.id);

    res.status(200).json({
      status: "success",
      message: "Product deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

export const uploadImages = async (
  req: AuthRequest & { params: Params },
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { productId } = req.params;
    const files = normalizeUploadedFiles(
      req.files as
        | Record<string, Express.Multer.File[]>
        | Express.Multer.File[]
        | undefined,
    );

    if (files.length === 0) {
      throw new ValidationError(
        'No images uploaded. Use form-data with file field "images"',
      );
    }

    const result = await uploadProductImages(productId, files);

    res.status(201).json({
      status: "success",
      message: "Images uploaded successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};
