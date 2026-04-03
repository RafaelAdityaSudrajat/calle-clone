
const CartDescription = () => {
  return (
    <div className="flex gap-5">
      {/* Product Image */}
      <div className="flex items-center justify-center flex-shrink-0 w-24 h-24 bg-gray-300 rounded-lg">
        <span className="text-4xl text-gray-600">i</span>
      </div>

      {/* Product Details */}
      <div className="flex flex-col flex-1">
        <h3 className="text-sm font-semibold text-gray-800">CALLE BOXER</h3>
        <p className="text-xs text-gray-500">S</p>
        <p className="text-lg font-bold text-gray-900">Rp 439,000</p>
      </div>
    </div>
  );
};

export default CartDescription;
