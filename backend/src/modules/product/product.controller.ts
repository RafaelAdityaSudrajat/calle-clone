import { Response, NextFunction, Request } from "express";
import {
  deleteProductVariantService,
  getAdminProductByIdService,
  getAdminProductsService,
  getProductByIdForOrderHistoryService,
  getPublicProductBySlugService,
  getPublicProductsService,
  updateProductVariantService,
  uploadProductImages,
} from "./product.service";
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
import catchAsync from "../../lib/catchAsync";

type Params = {
  productId: string;
};

export const createProduct = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const parsed = createProductSchema.safeParse(req);

    if (!parsed.success) {
      return next(parsed.error);
    }

    const product = await createProductService(parsed.data.body);

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

export const getPublicProducts = catchAsync(
  async (req: Request, res: Response) => {
    const result = await getPublicProductsService(req.query);

    res.status(200).json({
      status: "success",
      message: "Berhasil mengambil daftar produk",
      ...result,
    });
  },
);

export const getPublicProductBySlug = catchAsync(
  async (req: Request, res: Response) => {
    const { slug } = req.params;
    const product = await getPublicProductBySlugService(slug);

    res.status(200).json({
      status: "success",
      message: "Berhasil mengambil detail produk",
      data: product,
    });
  },
);

export const getProductForOrderHistory = catchAsync(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const product = await getProductByIdForOrderHistoryService(id);

    res.status(200).json({
      status: "success",
      message: "Berhasil mengambil data produk untuk histori order",
      data: product,
    });
  },
);

// ADMIN GET

export const getAdminProducts = catchAsync(
  async (req: Request, res: Response) => {
    const result = await getAdminProductsService(req.query);

    res.status(200).json({
      status: "success",
      message: "Berhasil mengambil seluruh katalog produk (Admin)",
      ...result,
    });
  },
);

export const getAdminProductById = catchAsync(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const product = await getAdminProductByIdService(id);

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
export const deleteProduct = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  const result = await deleteProductService(id);

  res.status(200).json({
    status: "success",
    deleteType: result.deleteType,
    message: result.message,
    data: result.data,
  });
});

export const deleteProductVariant = catchAsync(
  async (req: Request, res: Response) => {
    const { id } = req.params;

    const result = await deleteProductVariantService(id);

    res.status(200).json({
      status: "success",
      deleteType: result.deleteType,
      message: result.message,
      data: result.data,
    });
  },
);

export const updateProduct = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const updatedData = await updateProductService(id, req.body);

  res.status(200).json({
    status: "success",
    message: "Berhasil memperbarui data produk",
    data: updatedData,
  });
});

export const updateProductVariant = catchAsync(
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
