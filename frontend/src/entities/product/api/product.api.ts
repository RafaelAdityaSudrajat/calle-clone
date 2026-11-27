import { z } from "zod";
import { http, apiResponseSchema } from "@/shared/api";
import {
  createProductResponseSchema,
  lowStockListResponseSchema,
  productDetailSchema,
  productListResponseSchema,
  setPrimaryResponseSchema,
  statusChangeResponseSchema,
  stockResponseSchema,
  updateProductResponseSchema,
  variantListResponseSchema,
  variantMutationResponseSchema,
  imageSchema,
} from "../model/product.schema";
import type {
  CreateVariantPayload,
  ProductDetailOptions,
  ProductListParams,
  ProductPayload,
  UpdateVariantPayload,
  VariantListParams,
} from "../model/product.types";

const BASE = "/admin/products_v2";

const parse = <T extends z.ZodType>(schema: T, body: unknown): z.output<T> => {
  const parsed = apiResponseSchema(schema).parse(body) as { data: z.output<T> };
  return parsed.data;
};

// Flag boolean hanya dikirim saat true; undefined otomatis dibuang Axios.
const flag = (value?: boolean) => (value ? true : undefined);

// ── Produk ────────────────────────────────────────────
export const getProducts = async (params: ProductListParams = {}, signal?: AbortSignal) => {
  const res = await http.get(BASE, {
    signal,
    params: {
      page: params.page,
      limit: params.limit,
      search: params.search?.trim() || undefined,
      status: params.status,
      category_id: params.categoryId,
      include_deleted: flag(params.includeDeleted),
    },
  });
  return parse(productListResponseSchema, res.data);
};

export const getProductById = async (
  id: string,
  options: ProductDetailOptions = {},
  signal?: AbortSignal,
) => {
  const res = await http.get(`${BASE}/${id}`, {
    signal,
    params: { include_deleted: flag(options.includeDeleted) },
  });
  return parse(productDetailSchema, res.data);
};

export const createProduct = async (payload: ProductPayload) => {
  const res = await http.post(BASE, payload);
  return parse(createProductResponseSchema, res.data);
};

export const updateProduct = async (id: string, payload: Partial<ProductPayload>) => {
  const res = await http.put(`${BASE}/${id}`, payload);
  return parse(updateProductResponseSchema, res.data);
};

// Soft delete: backend tidak menyediakan restore.
export const archiveProduct = async (id: string): Promise<void> => {
  const res = await http.delete(`${BASE}/${id}`);
  parse(z.null(), res.data);
};

// Tanpa argumen body: request tidak membawa payload sama sekali.
export const publishProduct = async (id: string) =>
  parse(statusChangeResponseSchema, (await http.post(`${BASE}/${id}/publish`)).data);

export const republishProduct = async (id: string) =>
  parse(statusChangeResponseSchema, (await http.post(`${BASE}/${id}/republish`)).data);

export const unpublishProduct = async (id: string) =>
  parse(statusChangeResponseSchema, (await http.post(`${BASE}/${id}/unpublish`)).data);

// ── Varian ────────────────────────────────────────────
export const getVariants = async (
  productId: string,
  params: VariantListParams = {},
  signal?: AbortSignal,
) => {
  const res = await http.get(`${BASE}/${productId}/variants`, {
    signal,
    params: { include_deleted: flag(params.includeDeleted), low_stock: flag(params.lowStock) },
  });
  return parse(variantListResponseSchema, res.data).items;
};

export const createVariant = async (productId: string, payload: CreateVariantPayload) => {
  const res = await http.post(`${BASE}/${productId}/variants`, payload);
  return parse(variantMutationResponseSchema, res.data);
};

export const updateVariant = async (
  productId: string,
  variantId: string,
  payload: UpdateVariantPayload,
) => {
  const res = await http.put(`${BASE}/${productId}/variants/${variantId}`, payload);
  return parse(variantMutationResponseSchema, res.data);
};

export const deleteVariant = async (productId: string, variantId: string): Promise<void> => {
  const res = await http.delete(`${BASE}/${productId}/variants/${variantId}`);
  parse(z.null(), res.data);
};

export const updateStock = async (productId: string, variantId: string, stock: number) => {
  const res = await http.patch(`${BASE}/${productId}/variants/${variantId}/stock`, { stock });
  return parse(stockResponseSchema, res.data);
};

export const getLowStockVariants = async (signal?: AbortSignal) => {
  const res = await http.get(`${BASE}/low-stock`, { signal });
  return parse(lowStockListResponseSchema, res.data).items;
};

// ── Gambar ────────────────────────────────────────────
export const uploadProductImage = async (
  productId: string,
  file: File,
  onProgress?: (percent: number) => void,
) => {
  const form = new FormData();
  form.append("file", file); // nama field wajib "file" (sesuai controller)

  // Jangan set Content-Type manual: Axios mengisi boundary multipart sendiri.
  const res = await http.post(`${BASE}/${productId}/images`, form, {
    timeout: 60_000,
    onUploadProgress: (e) => {
      if (e.total) onProgress?.(Math.round((e.loaded / e.total) * 100));
    },
  });
  return parse(imageSchema, res.data);
};

export const setPrimaryImage = async (productId: string, imageId: string) => {
  const res = await http.patch(`${BASE}/${productId}/images/${imageId}/primary`);
  return parse(setPrimaryResponseSchema, res.data);
};

export const deleteProductImage = async (productId: string, imageId: string): Promise<void> => {
  const res = await http.delete(`${BASE}/${productId}/images/${imageId}`);
  parse(z.null(), res.data);
};