import { NextFunction, Response } from "express";
import { AuthRequest } from "../../middlewares/authenticate";
import { addToCartSchema } from "./cart.validation";
import { addToCartService, getCartByUserId } from "./cart.service";
import { UnauthorizedError } from "../../lib/errors";

export const addToCartController = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const body = addToCartSchema.parse(req.body);

    const { productVariantId, quantity } = body;
    const userId = req.auth?.userId;

    if (!userId) {
      throw new UnauthorizedError("Silakan login terlebih dahulu");
    }

    const payload = {
      userId,
      productVariantId,
      quantity,
    };

    const result = await addToCartService(payload);

    res.status(200).json({
      success: true,
      message: result.message,
      data: result.data,
    });
  } catch (error) {
    next(error);
  }
};

export const getCartByUserIdController = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = req.auth?.userId;

    if (!userId) {
      throw new UnauthorizedError("Silakan login terlebih dahulu");
    }

    const result = await getCartByUserId({ userId });

    res.status(200).json({
      success: true,
      message: result.message,
      data: result.data,
    });
  } catch (error) {
    next(error);
  }
};
