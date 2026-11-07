import { NextFunction, Response } from "express";
import catchAsync from "../../lib/catchAsync";
import { AuthRequest } from "../../middlewares/authenticate";
import { UnauthorizedError } from "../../lib/errors";
import {
  CreateProductInput,
  CreateVariantBodyInput,
  GetProductParams,
  GetProductQuery,
  ListProductsQuery,
  ListVariantsQuery,
  UpdateProductInput,
  UpdateProductParamsType,
  UpdateVariantBodyInput,
  UpdateVariantParams,
} from "./product_v2.schema";
import {
  createProductService,
  createVariantService,
  getListProductService,
  getProductDetailService,
  listVariantService,
  publishProductService,
  republishProductService,
  softDeleteProductService,
  softDeleteVariantService,
  unpublishProductService,
  updateProductService,
  updateVariantService,
} from "./product_v2.service";

export const createProductController = catchAsync(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const userId = req.auth?.userId;
    const input = req.body as CreateProductInput;

    if (!userId) {
      throw new UnauthorizedError("Silakan login terlebih dahulu");
    }

    const data = await createProductService(input, userId);

    res.status(201).json({
      success: true,
      message: "Product created successfully",
      data,
    });
  },
);

export const getListController = catchAsync(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const userId = req.auth?.userId;
    const query = (req as any).validatedQuery as ListProductsQuery;

    if (!userId) {
      throw new UnauthorizedError("Silakan login terlebih dahulu");
    }

    const data = await getListProductService(query);

    res.status(200).json({
      success: true,
      message: "Products retrieved successfully",
      data,
    });
  },
);

export const getProductDetailController = catchAsync(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const userId = req.auth?.userId;
    const { id } = req.params as unknown as GetProductParams;
    const query = (req as any).validatedQuery as GetProductQuery;

    if (!userId) {
      throw new UnauthorizedError("Silakan login terlebih dahulu");
    }

    const data = await getProductDetailService(id, query);

    res.status(200).json({
      success: true,
      message: "Product retrieved successfully",
      data,
    });
  },
);

export const updateProductController = catchAsync(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const userId = req.auth?.userId;
    const { id } = req.params as unknown as UpdateProductParamsType;
    const input = req.body as UpdateProductInput;

    if (!userId) {
      throw new UnauthorizedError("Silakan login terlebih dahulu");
    }

    const data = await updateProductService(id, input, userId);

    res.status(200).json({
      success: true,
      message: "Product updated successfully",
      data,
    });
  },
);

export const softDeleteProductController = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params as unknown as GetProductParams;
    const userId = req.auth?.userId;

    if (!userId) {
      throw new UnauthorizedError("Silakan login terlebih dahulu");
    }

    await softDeleteProductService(id, userId);

    res.status(200).json({
      success: true,
      message: "Product archived successfully",
      data: null,
    });
  },
);

export const publishProductController = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params as unknown as GetProductParams;
    const userId = req.auth?.userId;

    if (!userId) {
      throw new UnauthorizedError("Silakan login terlebih dahulu");
    }

    const data = await publishProductService(id, userId);

    res.status(200).json({
      success: true,
      message: "Product published successfully",
      data,
    });
  },
);

export const republishProductController = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params as unknown as GetProductParams;
    const userId = req.auth?.userId;

    if (!userId) {
      throw new UnauthorizedError("Silakan login terlebih dahulu");
    }

    const data = await republishProductService(id, userId);

    res.status(200).json({
      success: true,
      message: "Product republished successfully",
      data,
    });
  },
);

export const unpublishProductController = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params as unknown as GetProductParams;
    const userId = req.auth?.userId;

    if (!userId) {
      throw new UnauthorizedError("Silakan login terlebih dahulu");
    }

    const data = await unpublishProductService(id, userId);

    res.status(200).json({
      success: true,
      message: "Product unpublished successfully",
      data,
    });
  },
);

export const createVariantController = catchAsync(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const userId = req.auth?.userId;
    const { id } = req.params as unknown as GetProductParams;
    const input = req.body as CreateVariantBodyInput;

    if (!userId) {
      throw new UnauthorizedError("Silakan login terlebih dahulu");
    }

    const data = await createVariantService(id, input, userId);

    res.status(201).json({
      success: true,
      message: "Variant created successfully",
      data,
    });
  },
);

export const listVariantController = catchAsync(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const userId = req.auth?.userId;
    const { id } = req.params as unknown as GetProductParams;
    const query = (req as any).validatedQuery as ListVariantsQuery;

    if (!userId) {
      throw new UnauthorizedError("Silakan login terlebih dahulu");
    }

    const data = await listVariantService(id, query);

    res.status(200).json({
      success: true,
      message: "Variants retrieved successfully",
      data,
    });
  },
);

export const updateVariantController = catchAsync(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const userId = req.auth?.userId;
    const { productId, variantId } =
      req.params as unknown as UpdateVariantParams;
    const input = req.body as UpdateVariantBodyInput;

    if (!userId) {
      throw new UnauthorizedError("Silakan login terlebih dahulu");
    }

    const data = await updateVariantService(
      productId,
      variantId,
      input,
      userId,
    );

    res.status(200).json({
      success: true,
      message: "Variant updated successfully",
      data,
    });
  },
);

export const softDeleteVariantController = catchAsync(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const userId = req.auth?.userId;
    const { productId, variantId } =
      req.params as unknown as UpdateVariantParams;

    if (!userId) {
      throw new UnauthorizedError("Silakan login terlebih dahulu");
    }

    await softDeleteVariantService(productId, variantId, userId);

    res.status(200).json({
      success: true,
      message: "Variant deleted successfully",
      data: null,
    });
  },
);
