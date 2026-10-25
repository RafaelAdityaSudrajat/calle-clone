import { Response, NextFunction, Request } from "express";
import {
  deleteProductVariantService,
  getAdminProductByIdService,
  getAdminProductsService,
  getPublicProductBySlugService,
  getPublicProductsService,
  updateProductVariantService,
  uploadProductImages,
} from "./product.service";
import { ValidationError } from "../../lib/errors";
import { AuthRequest } from "../../middlewares/authenticate";
import { normalizeUploadedFiles } from "../../middlewares/upload";
import {
  createProductSchema,
  ProductIdParams,
  productVarintIdParams,
  SlugParams,
} from "./product.validation";
import { createProductService } from "./product.service";
import { getProductsQuerySchema } from "./product.validation";
import { updateProductSchema } from "./product.validation";
import { updateProductService } from "./product.service";
import { deleteProductService } from "./product.service";
import catchAsync from "../../lib/catchAsync";

type Params = {
  productId: string;
};

export const createProductController = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const product = await createProductService(req.body);

    res.status(201).json({
      status: "success",
      message: "Product created successfully",
      data: product,
    });
  } catch (error) {
    next(error);
  }
};

// GET PUBLIC

export const getPublicProductsController = catchAsync(
  async (req: Request, res: Response) => {
    const result = await getPublicProductsService(req.query);

    res.status(200).json({
      status: "success",
      message: "Berhasil mengambil daftar produk",
      ...result,
    });
  },
);

export const getPublicProductBySlugController = catchAsync(
  async (req: Request, res: Response) => {
    const { slug } = req.params as SlugParams;
    const product = await getPublicProductBySlugService(slug);

    res.status(200).json({
      status: "success",
      message: "Berhasil mengambil detail produk",
      data: product,
    });
  },
);

// ADMIN GET

export const getAdminProductsController = catchAsync(
  async (req: Request, res: Response) => {
    const result = await getAdminProductsService(req.query);

    res.status(200).json({
      status: "success",
      message: "Berhasil mengambil seluruh katalog produk (Admin)",
      ...result,
    });
  },
);

export const getAdminProductByIdController = catchAsync(
  async (req: Request, res: Response) => {
    const { productId } = req.params as ProductIdParams;
    console.log(productId);
    const product = await getAdminProductByIdService(productId);

    res.status(200).json({
      status: "success",
      message: "Berhasil mengambil detail produk (Admin)",
      data: product,
    });
  },
);

// DELETE

/**
 * FR-11 & FR-12: Endpoint Delete Product Induk oleh Admin
 */
export const deleteProductController = catchAsync(
  async (req: Request, res: Response) => {
    const { productId } = req.params as ProductIdParams;

    const result = await deleteProductService(productId);

    res.status(200).json({
      status: "success",
      deleteType: result.deleteType,
      message: result.message,
      data: result.data,
    });
  },
);

export const deleteProductVariantController = catchAsync(
  async (req: Request, res: Response) => {
    const { product_variant_id } = req.params as productVarintIdParams;

    const result = await deleteProductVariantService(product_variant_id);

    res.status(200).json({
      status: "success",
      deleteType: result.deleteType,
      message: result.message,
      data: result.data,
    });
  },
);

export const updateProductController = catchAsync(
  async (req: Request, res: Response) => {
    const { productId } = req.params as ProductIdParams;
    const updatedData = await updateProductService(productId, req.body);

    res.status(200).json({
      status: "success",
      message: "Berhasil memperbarui data produk",
      data: updatedData,
    });
  },
);

export const updateProductVariantController = catchAsync(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const updatedVariant = await updateProductVariantService(id, req.body);

    res.status(200).json({
      status: "success",
      message: "Berhasil memperbarui varian produk dan sinkronisasi stok",
      data: updatedVariant,
    });
  },
);

// export const updateProduct = async (
//   req: AuthRequest,
//   res: Response,
//   next: NextFunction,
// ): Promise<void> => {
//   try {
//     const parsed = updateProductSchema.safeParse(req.body);

//     if (!parsed.success) {
//       const message = parsed.error.issues[0]?.message || "Validation error";
//       throw new ValidationError(message);
//     }

//     const result = await updateProductService(req.params.id, parsed.data);

//     res.status(200).json({
//       status: "success",
//       message: "Product updated successfully",
//       data: result,
//     });
//   } catch (error) {
//     next(error);
//   }
// };

export const uploadImagesController = async (
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
