import { cn } from "@/shared/lib/cn";
import type { ProductStatus } from "../model/product.schema";
import { PRODUCT_STATUS_LABELS } from "../model/status";

const styles: Record<ProductStatus, string> = {
  DRAFT: "bg-gray-100 text-gray-700 ring-gray-500/20",
  ACTIVE: "bg-green-50 text-green-700 ring-green-600/20",
  INACTIVE: "bg-amber-50 text-amber-800 ring-amber-600/20",
};

export const ProductStatusBadge = ({ status }: { status: ProductStatus }) => (
  <span
    className={cn(
      "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
      styles[status],
    )}
  >
    {PRODUCT_STATUS_LABELS[status]}
  </span>
);