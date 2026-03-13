
const OrdersTabs = () => {
  return (
    <>
      <div className="flex items-center justify-between mt-3 mb-10 text-xs">
        <h3 className="font-medium text-gray-800">My Orders (0)</h3>

        <select className="px-3 py-2 bg-transparent border rounded-md outline-none border-zinc-200 focus:outline-none">
          <option>All status</option>
          <option>Pending</option>
          <option>Completed</option>
          <option>Cancelled</option>
        </select>
      </div>

      {/* Empty State */}
      <div className="flex flex-col items-center justify-center py-8 text-center text-gray-500">
        {/* Box Icon (Pure CSS) */}
        <div className="flex items-center justify-center w-16 h-16 mb-4 border-2 border-gray-300 rounded-md">
          <div className="w-8 h-8 rotate-45 border-2 border-gray-300"></div>
        </div>

        <p className="font-medium text-gray-700">No Orders Found</p>
        <p className="mt-1 text-sm text-gray-500">
          Place an order to see it listed here.
        </p>
      </div>
    </>
  );
};

export default OrdersTabs;
