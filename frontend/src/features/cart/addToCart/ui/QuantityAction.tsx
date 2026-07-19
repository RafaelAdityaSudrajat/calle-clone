import IncreaseQuantity from "./IncreaseQuantity";
import DecreaseQuantity from "./DecreaseQuantity";
import { useCart } from "../../hooks/useCart";

type QuantityActionProps = {
  productId?: string;
  quantity;
};

const QuantityAction = ({ productId = "1", quantity }: QuantityActionProps) => {
  const qty = quantity ?? 0;

  return (
    <div className="flex items-center border border-gray-300 rounded-full">
      <DecreaseQuantity />
      <span className="px-4 py-1 text-xs text-center border-gray-300">
        {qty}
      </span>
      <IncreaseQuantity productId={productId} />
    </div>
  );
};

export default QuantityAction;
