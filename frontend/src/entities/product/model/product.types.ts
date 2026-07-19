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
  price: string; // Menggunakan string karena pada JSON nilainya dibungkus string "900000"
  status: "ACTIVE" | "INACTIVE"; // Menggunakan literal type untuk status yang lebih aman
  images: ProductImageResponse[];
  categoryId: string;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProductVariant {
  id: string;
  size: string;
  color: string;
  stock: number;
  productId: string;
  createdAt: string;
  updatedAt: string;
  product: ProductResponse;
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
}
