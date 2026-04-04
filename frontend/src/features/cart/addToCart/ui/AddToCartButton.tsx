import type { ButtonHTMLAttributes, ReactNode } from "react";

import type { Product as CartProduct } from "@/features/cart/model/cartStore";

import { useAddToCart } from "../model/useAddToCart";

interface AddToCartButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick"> {
  product: CartProduct;
  quantity?: number;
  children?: ReactNode;
}

const AddToCartButton = ({
  product,
  quantity = 1,
  children = "Add to Cart",
  type = "button",
  ...buttonProps
}: AddToCartButtonProps) => {
  const { handleAddToCart } = useAddToCart();

  return (
    <button
      {...buttonProps}
      type={type}
      onClick={() => handleAddToCart(product, quantity)}
    >
      {children}
    </button>
  );
};

export default AddToCartButton;
