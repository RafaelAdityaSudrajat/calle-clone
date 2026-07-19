import QuantityAction from "./QuantityAction";

interface CartActionProps {
  quantity: number;
}

const CartAction = ({ quantity }: CartActionProps) => {
  return (
    <div className="flex items-center justify-between w-full mt-4">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-4">
          <button className="text-sm text-gray-600 underline hover:text-gray-800">
            Remove
          </button>
        </div>
      </div>

      <QuantityAction quantity={quantity} />
    </div>
  );
};

export default CartAction;
