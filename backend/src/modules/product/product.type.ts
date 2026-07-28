import { ProductStatus } from "../../generated/prisma";

export interface PaginationQuery {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface BuyerProductFilter extends PaginationQuery {
  search?: string;
  categorySlug?: string;
}

export interface AdminProductFilter extends PaginationQuery {
  search?: string;
  categoryId?: string;
  status?: ProductStatus;
  isDeleted?: boolean;
}

export interface UpdateProductInput {
  name?: string;
  categoryId?: string;
  description?: string;
  basePrice?: number | string;
  status?: ProductStatus;
  images?: {
    id?: string; // Jika ada ID -> update gambar eksisting
    url: string;
    isPrimary?: boolean;
    sortOrder?: number;
  }[];
}

export interface UpdateVariantInput {
  sku?: string;
  size?: string;
  color?: string;
  priceOverride?: number | string | null;
  stock?: number;
  isActive?: boolean;
}
