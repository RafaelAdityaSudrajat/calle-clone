import type { ProductStatus } from "./product.schema";

export const PRODUCT_STATUSES: readonly ProductStatus[] = ["DRAFT", "ACTIVE", "INACTIVE"];

export const PRODUCT_STATUS_LABELS: Record<ProductStatus, string> = {
  DRAFT: "Draft",
  ACTIVE: "Aktif",
  INACTIVE: "Nonaktif",
};