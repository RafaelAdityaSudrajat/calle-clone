import type { ProductStatus } from "./product.schema";

export interface ProductListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: ProductStatus;
  categoryId?: string;
  includeDeleted?: boolean;
}

export interface ProductDetailOptions {
  includeDeleted?: boolean;
}

export interface VariantListParams {
  includeDeleted?: boolean;
  lowStock?: boolean;
}

// Payload ke backend (snake_case sesuai kontrak)
export interface ProductPayload {
  name: string;
  description?: string | null;
  category_id?: string | null;
}

export interface CreateVariantPayload {
  sku: string;
  size?: string | null;
  color?: string | null;
  price: number;
  stock: number;
}
export type UpdateVariantPayload = Partial<CreateVariantPayload>;
