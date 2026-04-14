import { useCart } from "../hooks/useCart";

const DecreaseQuantity = () => {
  const { decreaseQuantity, getItemById } = useCart();
  const product = getItemById("1");
  const quantity = product?.quantity ?? 0;

  return (
    <button
      className={`px-3 py-1 ${quantity >= 1 ? "text-black" : "text-red-500"}`}
      onClick={() => decreaseQuantity("1")}
    >
      -
    </button>
  );
};

export default DecreaseQuantity;
