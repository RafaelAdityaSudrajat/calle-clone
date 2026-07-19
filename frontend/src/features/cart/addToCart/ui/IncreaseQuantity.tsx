import { useCart } from "../../hooks/useCart";

type IncreaseQuantityProps = {
  productId: string;
};

const IncreaseQuantity = ({ productId }: IncreaseQuantityProps) => {
  const { increaseQuantity } = useCart();

  return (
    <button
      type="button"
      className="px-3 py-1 text-gray-600"
      onClick={() => increaseQuantity(productId)}
    >
      +
    </button>
  );
};

export default IncreaseQuantity;
