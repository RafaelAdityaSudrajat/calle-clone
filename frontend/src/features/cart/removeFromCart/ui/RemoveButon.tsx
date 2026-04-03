import { useCart } from "../../hooks/useCart";

const RemoveButon = () => {
  const { removeFromCart } = useCart()

  return (
    <div className="flex items-center gap-4">
      <button
        className="text-sm text-gray-600 underline hover:text-gray-800"
        onClick={() => removeFromCart("1")}
      >
        Remove
      </button>
    </div>
  );
};

export default RemoveButon;
