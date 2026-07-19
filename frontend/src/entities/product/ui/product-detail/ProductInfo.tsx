import { type ProductResponse } from "@/entities/product";
import SizeProductDetail from "./SizeProductDetail";
import { useProductInfo } from "../../hooks/use-productInfo";
import ButtonAddToCart from "@/features/cart/addToCart/ui/ButtonAddToCart";
import { formatRupiah } from "@/shared/utils/formatRupiah";

interface ProductInfoProps {
  product: ProductResponse;
}

const ProductInfo = ({ product }: ProductInfoProps) => {
  const {
    sizes,
    size,
    qty,
    displayedPrice,
    availableStock,
    handleSize,
    increaseQty,
    decreaseQty,
    selectedVariant,
  } = useProductInfo({ product });

  console.log(selectedVariant);

  const valueCart = {
    productVariantId: selectedVariant.id,
    quantity: qty,
  };

  return (
    <div className="sticky self-start top-28">
      <div className="flex flex-col gap-2">
        <div className="px-3 text-[.8500rem] text-white bg-gray-700 rounded-xs w-fit">
          {availableStock > 0 ? "Low Stock" : "Out of Stock"}
        </div>

        <h1 className="text-xl font-semibold tracking-wide">{product.name}</h1>

        <p className="text-lg font-medium">
          {formatRupiah(Number(displayedPrice))}
        </p>

        <div className="p-4 text-sm border rounded-lg">
          <p className="mb-1 font-medium">Quantity Information</p>
          <p className="text-gray-500">Maximum Quantity: {availableStock}</p>
        </div>

        {sizes.length > 0 && (
          <SizeProductDetail
            size={size}
            sizes={sizes}
            handleSize={handleSize}
          />
        )}

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
            <ButtonAddToCart valueAddToCart={valueCart} />
          </div>

          <div className="hidden lg:block">
            <ButtonAddToCart valueAddToCart={valueCart} />
          </div>

          <button className="hidden w-full py-3 font-medium text-white bg-black rounded-lg lg:block">
            Buy It Now
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProductInfo;
