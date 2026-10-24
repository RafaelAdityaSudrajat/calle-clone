import { NextFunction, Response } from "express";
import { AuthRequest } from "../../middlewares/authenticate";
import { UnauthorizedError } from "../../lib/errors";
import catchAsync from "../../lib/catchAsync";
import { getOrderByIdService, getOrdersService } from "./order.service";
import { ListOrdersQuery, OrderParams } from "./order.schema";

/**
 * GET /api/v1/orders
 *
 * Query sudah divalidasi & di-coerce oleh middleware `validate`
 * (lihat listOrdersSchema), dan hasilnya disimpan di req.validatedQuery
 * -- BUKAN di req.query, karena Express 5 membuat req.query read-only.
 * Pola ini sama dengan req.validatedHeaders di checkoutController.
 */
export const listOrdersController = catchAsync(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const userId = req.auth?.userId;
    if (!userId) {
      throw new UnauthorizedError("Silakan login terlebih dahulu");
    }

    const query = req.validatedQuery as ListOrdersQuery | undefined;
    if (!query) {
      // Fail loud: lebih baik ketahuan saat development daripada
      // diam-diam pakai default yang tidak diinginkan di production.
      throw new Error(
        "validatedQuery missing: pasang listOrdersSchema di route",
      );
    }

    const data = await getOrdersService(userId, query);

    res.status(200).json({
      success: true,
      message: "Orders retrieved successfully",
      data,
    });
  },
);

export const getOrderByIdController = catchAsync(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const userId = req.auth?.userId;
    if (!userId) {
      throw new UnauthorizedError("Silakan login terlebih dahulu");
    }

    const params = req.params as OrderParams | undefined;
    if (!params) {
      throw new Error(
        "validatedParams missing: pasang getOrderByIdSchema di route",
      );
    }

    const data = await getOrderByIdService(userId, params.orderId);

    res.status(200).json({
      success: true,
      message: "Order retrieved successfully",
      data,
    });
  },
);
