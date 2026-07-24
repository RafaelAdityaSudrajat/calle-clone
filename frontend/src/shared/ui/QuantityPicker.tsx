
interface QuantityPickerProps {
    decreaseQty : () => void
    increaseQty : () => void
    qty : number
    availableStock: number;
}

const QuantityPicker = ({decreaseQty, increaseQty, qty, availableStock} : QuantityPickerProps) => {
  return (
    <div className="flex items-center overflow-hidden border rounded-full">
      <button
        className={`flex items-center justify-center w-10 h-10 ${qty <= 1 && "text-gray-400"}`}
        onClick={decreaseQty}
        disabled={qty <= 1}
      >
        -
      </button>
      <span className="w-10 text-sm text-center">{qty}</span>
      <button
        className={`flex items-center justify-center w-10 h-10 ${qty === availableStock && "text-gray-400"}`}
        onClick={increaseQty}
        disabled={qty === availableStock}
      >
        +
      </button>
    </div>
  );
};

export default QuantityPicker;
