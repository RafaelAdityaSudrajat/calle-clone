import { Link } from "react-router-dom";

import { AddToCartButton } from "@/features/cart/addToCart";

import { formatProductPrice } from "../lib/format-price";
import type { ProductResponse } from "../model/product.types";

const PRODUCT_FALLBACK_IMAGE =
  "https://d2kchovjbwl1tk.cloudfront.net/vendor/9549/product/1_1766377064172_resized1024-jpg.webp";

interface ProductCardProps {
  product: ProductResponse;
}

const ProductCard = ({ product }: ProductCardProps) => {
  const primaryImage = product.images[0]?.url ?? PRODUCT_FALLBACK_IMAGE;

  const cartProduct = {
    id: product.id,
    name: product.name,
    price: Number(product.price),
    image: primaryImage,
  };

  return (
    <article className="px-3 rounded-md">
      <div className="flex flex-col">
        <Link to={`/products/${product.id}`} className="flex justify-center">
          <img
            src={primaryImage}
            alt={product.name}
            className="w-full rounded-md"
          />
        </Link>

        <div className="flex flex-col items-center gap-2 px-1 mt-3 text-[clamp(.5rem,2vw,.8rem)] text-zinc-800 text-start md:items-start md:px-5">
          <p className="text-center md:text-start">{product.name}</p>

          <div className="flex items-center justify-between w-full gap-3">
            <p className="text-center md:text-start">
              {formatProductPrice(product.price)}
            </p>

            <AddToCartButton
              product={cartProduct}
              disabled={product.stock <= 0}
              className="px-2 py-1 text-white transition-all duration-300 bg-black rounded-md hover:bg-white hover:text-black hover:border disabled:cursor-not-allowed disabled:border disabled:bg-zinc-200 disabled:text-zinc-500"
            >
              {product.stock > 0 ? "Add to Cart" : "Sold Out"}
            </AddToCartButton>
          </div>
        </div>
      </div>
    </article>
  );
};

export default ProductCard;
