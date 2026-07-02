// src/entities/product/model/product.types.ts

export interface ProductCategoryResponse {
  id: string;
  name: string;
  slug: string;
}

export interface ProductImageResponse {
  id: string;
  url: string;
  isPrimary: boolean;
  order: number;
  productId: string;
  createdAt: string;
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
  description: string | null;
  price: string; // BE returns string
  stock: number;
  isActive: boolean;
  categoryId: string;
  createdAt: string;
  updatedAt: string;
  category: ProductCategoryResponse;
  variants: ProductVariantResponse[];
  images: ProductImageResponse[];
}

export interface AddProductApiResponse {
  status: string;
  message: string;
  data: ProductResponse;
}

export interface GetProductsApiResponse {
  status: string;
  data: ProductResponse[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface GetProductByIdApiResponse {
  status: string;
  data: ProductResponse;
}

export interface AddImagesResponse {
  status: string;
  message: string;
  data: ProductResponse;
}

export interface UploadImagesInput {
  productId: string;
  formData: FormData;
};