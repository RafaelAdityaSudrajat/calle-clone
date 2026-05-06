// src/entities/product/model/product.types.ts

export interface ProductCategoryResponse {
  id: string;
  name: string;
  slug: string;
}

export interface ProductVariantResponse {
  id: string;
  size: string;
  color: string;
  stock: number;
  price: string | null;
  productId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProductResponse {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: string; // BE returns string
  stock: number;
  isActive: boolean;
  categoryId: string;
  createdAt: string;
  updatedAt: string;
  category: ProductCategoryResponse;
  variants: ProductVariantResponse[];
  images: string[];
}

export interface AddProductApiResponse {
  status: string;
  message: string;
  data: ProductResponse;
}