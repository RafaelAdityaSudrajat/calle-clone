import { Link } from "react-router-dom";
import { formatProductPrice } from "../lib/format-price";
import type { ProductResponse } from "../model/product.types";

const PRODUCT_FALLBACK_IMAGE =
  "https://d2kchovjbwl1tk.cloudfront.net/vendor/9549/product/1_1766377064172_resized1024-jpg.webp";

interface ProductCardProps {
  product: ProductResponse;
}

const ProductCard = ({ product }: ProductCardProps) => {
  const primaryImage = product.images[0]?.url ?? PRODUCT_FALLBACK_IMAGE;

  return (
    <article className="px-3 rounded-md">
      <div className="flex flex-col">
        <Link
          to={`/products/${product.id}`}
          className="flex justify-center overflow-hidden aspect-[4/5]"
        >
          <img
            src={primaryImage}
            alt={product.name}
            className="object-cover w-full h-full rounded-md"
          />
        </Link>

        <div className="flex flex-col items-center gap-2 px-1 mt-3 text-[clamp(.5rem,2vw,.8rem)] text-zinc-800 text-start md:items-start md:px-5">
          <p className="text-center md:text-start">{product.name}</p>

          <div className="flex items-center justify-between w-full gap-3">
            <p className="text-center md:text-start">
              {formatProductPrice(product.price)}
            </p>
          </div>
        </div>
      </div>
    </article>
  );
};

export default ProductCard;
