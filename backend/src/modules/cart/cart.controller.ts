import { NextFunction, Response } from "express";
import { AuthRequest } from "../../middlewares/authenticate";
import { UnauthorizedError } from "../../lib/errors";
import catchAsync from "../../lib/catchAsync";
import {
  addToCartService,
  checkoutService,
  getCartService,
  removeCartItemService,
  updateCartItemService,
} from "./cart.service";
import {
  AddToCartInput,
  CheckoutBodyInput,
  UpdateCartItemInput,
} from "./cart.schema";

// export const addToCartController = async (
//   req: AuthRequest,
//   res: Response,
//   next: NextFunction,
// ) => {
//   try {
//     const body = addToCartSchema.parse(req.body);

//     const { productVariantId, quantity } = body;
//     const userId = req.auth?.userId;

//     if (!userId) {
//       throw new UnauthorizedError("Silakan login terlebih dahulu");
//     }

//     const payload = {
//       userId,
//       productVariantId,
//       quantity,
//     };

//     const result = await addToCartService(payload);

//     res.status(200).json({
//       success: true,
//       message: result.message,
//       data: result.data,
//     });
//   } catch (error) {
//     next(error);
//   }
// };

// export const getCartByUserIdController = async (
//   req: AuthRequest,
//   res: Response,
//   next: NextFunction,
// ): Promise<void> => {
//   try {
//     const userId = req.auth?.userId;

//     if (!userId) {
//       throw new UnauthorizedError("Silakan login terlebih dahulu");
//     }

//     const result = await getCartByUserId({ userId });

//     res.status(200).json({
//       success: true,
//       message: result.message,
//       data: result.data,
//     });
//   } catch (error) {
//     next(error);
//   }
// };

export const getCartController = catchAsync(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const userId = req.auth?.userId;

    if (!userId) {
      throw new UnauthorizedError("Silakan login terlebih dahulu");
    }

    const data = await getCartService(userId);

    res.status(200).json({
      success: true,
      message: "Cart retrieved successfully",
      data,
    });
  },
);

/**
 * POST /api/v1/cart
 * body sudah divalidasi & di-transform ke camelCase oleh middleware `validate`
 * memakai `addToCartSchema` (lihat cart.schema.ts), jadi di sini req.body
 * sudah pasti berbentuk AddToCartInput.
 */
export const addToCartController = catchAsync(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const userId = req.auth?.userId;
    const input = req.body as AddToCartInput;

    if (!userId) {
      throw new UnauthorizedError("Silakan login terlebih dahulu");
    }

    const data = await addToCartService(userId, input);

    res.status(201).json({
      success: true,
      message: "Item added to cart",
      data,
    });
  },
);

export const updateCartItemController = catchAsync(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const userId = req.auth?.userId;
    if (!userId) {
      throw new UnauthorizedError();
    }

    const cartItemId = req.params.cartItemId as string;
    const input = req.body as UpdateCartItemInput;

    const data = await updateCartItemService(userId, cartItemId, input);

    res.status(200).json({
      success: true,
      message:
        input.quantity === 0 ? "Item removed from cart" : "Cart item updated",
      data,
    });
  },
);

export const removeCartItemController = catchAsync(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const userId = req.auth?.userId;
    if (!userId) {
      throw new UnauthorizedError();
    }

    const cartItemId = req.params.cartItemId as string; // Express 5: tipe params mengizinkan string[], route ini segmen tunggal

    const data = await removeCartItemService(userId, cartItemId);

    res.status(200).json({
      success: true,
      message: "Item removed from cart",
      data,
    });
  },
);

export const checkoutController = catchAsync(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const userId = req.auth?.userId;
    if (!userId) {
      throw new UnauthorizedError();
    }

    // Body sudah camelCase hasil transform di `validate`.
    const body = req.body as CheckoutBodyInput;

    // Header hasil parse disimpan `validate` di req.validatedHeaders,
    // req.headers asli sengaja tidak ditimpa.
    const headers = req.validatedHeaders;
    if (!headers) {
      throw new Error(
        "validatedHeaders missing: pasang checkoutSchema di route",
      );
    }

    const data = await checkoutService(userId, {
      ...body,
      idempotencyKey: headers.idempotencyKey,
    });

    res.status(data.idempotent_replay ? 200 : 201).json({
      success: true,
      message: data.idempotent_replay
        ? "Order already created for this request"
        : "Order created successfully",
      data,
    });
  },
);
