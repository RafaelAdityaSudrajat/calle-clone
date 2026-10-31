import { AppError } from "../../lib/errors";

export const ProductErrors = {
  productNotFound: () =>
    new AppError("Product not found", 404, "PRODUCT_NOT_FOUND"),

  productNotAvailable: (reason?: string) =>
    new AppError(
      reason ?? "This product is no longer available", //Produk non-ACTIVE / soft-delete
      400,
      "PRODUCT_NOT_AVAILABLE",
    ),
};
