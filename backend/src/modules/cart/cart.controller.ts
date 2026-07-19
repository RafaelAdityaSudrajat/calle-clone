import { NextFunction, Response } from "express";
import { AuthRequest } from "../../middlewares/authenticate";
import { addToCartSchema } from "./cart.validation";
import { addToCartService, getCartByUserId } from "./cart.service";
import { getCategoryByIdService } from "../category/category.service";

export const addToCartController = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const body = addToCartSchema.parse(req.body);

    const { productVariantId, quantity } = body;
    const userId = req.userId;

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
    const userId = req.userId;

    console.log(userId)

    const result = await getCartByUserId({userId});

    res.status(200).json({
      status: "success",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};
