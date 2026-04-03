import IncreaseQuantity from "./IncreaseQuantity";
import DecreaseQuantity from "./DecreaseQuantity";
import { useCart } from "../hooks/useCart";

type QuantityActionProps = {
  productId?: string;
};

const QuantityAction = ({ productId = "1" }: QuantityActionProps) => {
  const { getItemById } = useCart();

  const product = getItemById(productId);
  const quantity = product?.quantity ?? 0;

  return (
    <div className="flex items-center border border-gray-300 rounded-full">
      <DecreaseQuantity />
      <span className="px-4 py-1 text-xs text-center border-gray-300">
        {quantity}
      </span>
      <IncreaseQuantity productId={productId} />
    </div>
  );
};

export default QuantityAction;
