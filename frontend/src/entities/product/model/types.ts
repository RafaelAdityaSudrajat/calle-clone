import type {
  ProductResponse,
  ProductVariantResponse,
} from "./product.types";

export type Product = ProductResponse;
export type ProductSize = ProductVariantResponse["size"];
