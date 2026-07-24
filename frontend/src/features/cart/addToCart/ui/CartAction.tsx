import QuantityPicker from "@/shared/ui/QuantityPicker";

interface CartActionProps {
  quantity: number;
}

const CartAction = ({ quantity }: CartActionProps) => {
  const increaseQty = () => {};

  const decreaseQty = () => {};

  return (
    <div className="flex items-center justify-between w-full mt-4">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-4">
          <button className="text-sm text-gray-600 underline hover:text-gray-800">
            Remove
          </button>
        </div>
      </div>

      <QuantityPicker
        qty={quantity}
        increaseQty={increaseQty}
        decreaseQty={decreaseQty}
        availableStock={9}
      />
    </div>
  );
};

export default CartAction;
