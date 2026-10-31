import { NextFunction, Response } from "express";
import catchAsync from "../../lib/catchAsync";
import { AuthRequest } from "../../middlewares/authenticate";
import { UnauthorizedError } from "../../lib/errors";
import { CreateProductInput, ListProductsQuery } from "./product_v2.schema";
import {
  createProductService,
  getListProductService,
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
