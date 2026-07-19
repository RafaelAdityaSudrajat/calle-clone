import type { ProductVariant } from "@/entities/product/model/product.types";

export type CartStatus = "ACTIVE" | "CHECKOUT_IN_PROGRESS";

export interface CartItem {
  id: string;
  cartId: string;
  productVariantId: string;
  quantity: number;
  createdAt: string;
  updatedAt: string;
  productVariant: ProductVariant;
}

export interface CartList {
  id: string;
  userId: string;
  status: CartStatus;
  createdAt: string;
  updatedAt: string;
  cartItems: CartItem[];
}

export interface CartResponse {
  data: CartList;
  success: boolean;
  message: string;
}
