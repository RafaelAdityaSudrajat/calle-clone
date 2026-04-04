import { useState } from "react";
import { AddToCartButton } from "@/features/cart/addToCart";
import type { Product } from "@/shared/types/typeProduct";
import SizeProductDetail from "./SizeProductDetail";

type ProductSize = "S" | "M" | "L" | "XL" | "XXL";

interface ProductInfoProps {
  product: Product;
}

const ProductInfo = ({ product }: ProductInfoProps) => {
  const [size, setSize] = useState<ProductSize>("S");
  const [qty, setQty] = useState<number>(1);

  const handleSize = (value: ProductSize) => {
    setSize(value);
  };

  const increaseQty = () =>
    setQty((prev) => (prev >= product.stock ? prev : prev + 1));
  const decreaseQty = () =>
    setQty((prev) => (prev <= 1 ? prev : prev - 1));

  const cartProduct = {
    id: product.id,
    name: product.name,
    price: product.price,
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="px-3 text-[.8500rem] text-white bg-gray-700 rounded-xs w-fit">
        {product.stock > 0 ? "Low Stock" : "Out of Stock"}
      </div>

      <h1 className="text-xl font-semibold tracking-wide">{product.name}</h1>

      <p className="text-lg font-medium">
        Rp {product.price.toLocaleString("id-ID")}
      </p>

      <div className="p-4 text-sm border rounded-lg">
        <p className="mb-1 font-medium">Quantity Information</p>
        <p className="text-gray-500">Maximum Quantity: {product.stock}</p>
      </div>

      <SizeProductDetail size={size} handleSize={handleSize} />

      <div className="flex items-center justify-center gap-4">
        <div className="flex items-center overflow-hidden border rounded-full">
          <button
            className="flex items-center justify-center w-10 h-10"
            onClick={decreaseQty}
          >
            -
          </button>
          <span className="w-10 text-sm text-center">{qty}</span>
          <button
            className="flex items-center justify-center w-10 h-10"
            onClick={increaseQty}
          >
            +
          </button>
        </div>
      </div>

      <div className="flex-col gap-3 mt-4 lg:flex">
        <div className="fixed left-0 w-full px-4 bottom-3 lg:hidden">
          <AddToCartButton
            product={cartProduct}
            quantity={qty}
            className="w-full py-3 font-medium text-white bg-black rounded-lg"
            disabled={product.stock <= 0}
          />
        </div>

        <div className="hidden lg:block">
          <AddToCartButton
            product={cartProduct}
            quantity={qty}
            className="w-full py-3 font-medium text-black bg-white border border-black rounded-full hover:text-white hover:bg-black"
            disabled={product.stock <= 0}
          />
        </div>

        <button className="hidden w-full py-3 font-medium text-white bg-black rounded-full lg:block">
          Buy It Now
        </button>
      </div>
    </div>
  );
};

export default ProductInfo;
