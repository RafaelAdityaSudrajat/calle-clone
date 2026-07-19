import { formatRupiah } from "@/shared/utils/formatRupiah";
import type { CartItem } from "../model/cart.types";

interface CartDescriptionProps {
  cartItem: CartItem;
}

const CartDescription = ({ cartItem }: CartDescriptionProps) => {
  const { name, price } = cartItem.productVariant.product;
  const { size } = cartItem.productVariant;
  const { images } = cartItem.productVariant.product;

  return (
    <div className="flex gap-5">
      {/* Product Image */}
      <div className="flex items-center justify-center flex-shrink-0 w-24 h-24 overflow-hidden bg-gray-300 rounded-lg">
        <img
          src={images[0].url}
          alt="images cartitem"
          className="object-cover w-full h-full"
        />
      </div>

      {/* Product Details */}
      <div className="flex flex-col flex-1">
        <h3 className="text-sm font-semibold text-gray-800">{name}</h3>
        <p className="text-xs text-gray-500">{size}</p>
        <p className="text-lg font-bold text-gray-900">
          {formatRupiah(Number(price))}
        </p>
      </div>
    </div>
  );
};

export default CartDescription;
