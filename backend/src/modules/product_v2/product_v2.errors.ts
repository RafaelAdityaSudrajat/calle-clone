import { AppError } from "../../lib/errors";

export const ProductErrors = {
  productNotFound: () =>
    new AppError("Product not found", 404, "PRODUCT_NOT_FOUND"),

  variantNotFound: () =>
    new AppError("Variant not found", 404, "VARIANT_NOT_FOUND"),

  imageNotFound: () => new AppError("Image not found", 404, "IMAGE_NOT_FOUND"),

  categoryNotFound: () =>
    new AppError("Category not found", 404, "CATEGORY_NOT_FOUND"),

  categoryRequired: () =>
    new AppError("Category is required", 400, "CATEGORY_REQUIRED"),

  productNeedsVariant: () =>
    new AppError(
      "Product must have at least one active variant",
      400,
      "PRODUCT_NEEDS_VARIANT",
    ),

  productNeedsImage: () =>
    new AppError(
      "Product must have at least one image",
      400,
      "PRODUCT_NEEDS_IMAGE",
    ),

  productNeedsPrimaryImage: () =>
    new AppError(
      "Product must have a primary image",
      400,
      "PRODUCT_NEEDS_PRIMARY_IMAGE",
    ),

  invalidPrice: () =>
    new AppError("Price must be greater than zero", 400, "INVALID_PRICE"),

  invalidStock: () =>
    new AppError("Stock cannot be negative", 400, "INVALID_STOCK"),

  invalidStatusTransition: () =>
    new AppError(
      "Invalid product status transition",
      400,
      "INVALID_STATUS_TRANSITION",
    ),

  attributeRequired: () =>
    new AppError(
      "At least one of size or color must be provided",
      400,
      "ATTRIBUTE_REQUIRED",
    ),

  skuDuplicate: () =>
    new AppError("SKU is already in use", 409, "SKU_DUPLICATE"),

  variantDuplicate: () =>
    new AppError(
      "A variant with the same size and color already exists",
      409,
      "VARIANT_DUPLICATE",
    ),

  invalidFileType: () =>
    new AppError("Unsupported file type", 400, "INVALID_FILE_TYPE"),

  fileTooLarge: () =>
    new AppError("File size exceeds the allowed limit", 400, "FILE_TOO_LARGE"),

  internalError: () =>
    new AppError("An unexpected server error occurred", 500, "INTERNAL_ERROR"),
};
