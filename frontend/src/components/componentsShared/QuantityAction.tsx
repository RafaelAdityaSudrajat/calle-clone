import { useQuantity } from "../cart/cart-context/QuantityContext";

const QuantityAction = () => {
  const { quantity, increaseQuantity, decreaseQuantity } = useQuantity();

  return (
    <div className="flex items-center border border-gray-300 rounded-full">
      <button className={`px-3 py-1 ${quantity <= 1 ? "text-gray-300" : "text-gray-600"}`}onClick={decreaseQuantity}>
        -
      </button>
      <span className="px-4 py-1 text-xs text-center border-gray-300">
        {quantity}
      </span>
      <button className="px-3 py-1 text-gray-600" onClick={increaseQuantity}>
        +
      </button>
    </div>
  );
};

export default QuantityAction;
