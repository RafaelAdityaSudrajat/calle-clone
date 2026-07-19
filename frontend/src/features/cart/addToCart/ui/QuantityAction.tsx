import IncreaseQuantity from "./IncreaseQuantity";
import DecreaseQuantity from "./DecreaseQuantity";

type QuantityActionProps = {
  quantity: number;
};

const QuantityAction = ({ quantity }: QuantityActionProps) => {
  const qty = quantity ?? 0;

  return (
    <div className="flex items-center border border-gray-300 rounded-full">
      <DecreaseQuantity />
      <span className="px-4 py-1 text-xs text-center border-gray-300">
        {qty}
      </span>
      <IncreaseQuantity />
    </div>
  );
};

export default QuantityAction;
