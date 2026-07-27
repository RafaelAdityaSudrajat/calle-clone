import { ProductStatus } from "../../generated/prisma";

export interface PaginationQuery {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
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