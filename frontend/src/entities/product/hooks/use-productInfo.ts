import { useEffect, useMemo, useState } from "react";
import type { Product, ProductSize } from "../model/types";

type useProductInfoProps = {
  product: Product;
};

export function useProductInfo({ product }: useProductInfoProps) {
  const sizes = useMemo(
    () => Array.from(new Set(product.variants.map((variant) => variant.size))),
    [product],
  );

  const [size, setSize] = useState<ProductSize | "">(sizes[0] ?? "");

  const [qty, setQty] = useState(1);

  const selectedVariant = useMemo(
    () => product.variants.find((variant) => variant.size === size),
    [product, size],
  );

  const availableStock = selectedVariant?.stock ?? 0;
  const displayedPrice = product.price;

  const handleSize = (value: ProductSize) => {
    setSize(value);
    setQty(1);
  };

  const increaseQty = () => {
    setQty((prev) => {
      // Jika stock kosong atau 0, jangan biarkan bertambah
      if (availableStock === 0) return prev;
      // Batasi agar tidak melebihi stock yang tersedia
      return prev >= availableStock ? prev : prev + 1;
    });
  };

  const decreaseQty = () => {
    setQty((prev) => (prev <= 1 ? prev : prev - 1));
  };

  const cartProduct = {
    id: product.id,
    name: product.name,
    price: Number(displayedPrice),
    image: product.images[0]?.url,
  };

  return {
    sizes,
    size,
    qty,
    selectedVariant,
    availableStock,
    displayedPrice,
    cartProduct,

    setQty,
    handleSize,
    increaseQty,
    decreaseQty,
  };
}
