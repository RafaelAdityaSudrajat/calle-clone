import { useCart } from "../hooks/useCart";

const DecreaseQuantity = () => {
  const { decreaseQuantity,getItemById } = useCart();
  
    const product = getItemById("1")
  return (
    <button
      className={`px-3 py-1 ${product?.quantity >= 1 ? "text-black" : "text-red-500"}`}
      onClick={() => decreaseQuantity("1")}
    >
      -
    </button>
  );
};

export default DecreaseQuantity;
