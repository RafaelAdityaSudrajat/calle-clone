const WishlistTabs = () => {
  return (
    <>
      <div className="flex flex-col items-center justify-center py-8 text-center text-gray-500">
        {/* Box Icon (Pure CSS) */}
        <div className="flex items-center justify-center w-16 h-16 mb-4 border-2 border-gray-300 rounded-md">
          <div className="w-8 h-8 rotate-45 border-2 border-gray-300"></div>
        </div>

        <p className="font-medium text-gray-700">No Wishlist Found</p>
        <p className="mt-1 text-sm text-gray-500">
          Place an Wishlist to see it listed here.
        </p>
      </div>
    </>
  );
};

export default WishlistTabs;
