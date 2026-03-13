import { useState } from "react";
import SizeProductDetail from "./SizeProductDetail";
import AddToCart from "./AddToCart";

const ProductInfo = () => {
  const [size, setSize] = useState<string>("");
  const [qty, setQty] = useState<number>(1);

  const handleSize = (value: string) => {
    setSize(value);
  };

  const increaseQty = () => setQty((prev) => prev + 1);
  const decreaseQty = () =>
    setQty((prev) => (prev <= 1 ? prev : prev - 1));

  return (
    <div className="flex flex-col gap-2">
      <div className="px-3 text-[.8500rem] text-white bg-gray-700 rounded-xs w-fit">
        Low Stock
      </div>

      <h1 className="text-xl font-semibold tracking-wide">
        CALLE CREWNECK GREY
      </h1>

      <p className="text-lg font-medium">Rp 549,000</p>

      <div className="p-4 text-sm border rounded-lg">
        <p className="mb-1 font-medium">Quantity Information</p>
        <p className="text-gray-500">Maximum Quantity: 2</p>
      </div>

      <SizeProductDetail size={size} handleSize={handleSize} />

      <div className="flex items-center justify-center gap-4">
        <div className="flex items-center overflow-hidden border rounded-full">
          <button
            className="flex items-center justify-center w-10 h-10"
            onClick={decreaseQty}
          >
            -
          </button>
          <span className="w-10 text-sm text-center">{qty}</span>
          <button
            className="flex items-center justify-center w-10 h-10"
            onClick={increaseQty}
          >
            +
          </button>
        </div>
      </div>

      <div className="flex-col gap-3 mt-4 lg:flex">
        <div className="fixed left-0 w-full px-4 bottom-3 lg:hidden">
          <AddToCart variant="mobile" />
        </div>

        <div className="hidden lg:block">
          <AddToCart variant="desktop" />
        </div>

        <button className="hidden w-full py-3 font-medium text-white bg-black rounded-full lg:block">
          Buy It Now
        </button>
      </div>
    </div>
  );
};

export default ProductInfo;
