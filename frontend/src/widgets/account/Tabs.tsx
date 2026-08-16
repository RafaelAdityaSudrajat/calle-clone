import { Link, useSearchParams } from "react-router-dom";
import TabsContent from "../../pages/account/TabsContent";

type Tab = "orders" | "wishlist";

const TabsCard = () => {
  const [searchParams] = useSearchParams();
  const rawTab = searchParams.get("tabs");

  const activeTab: Tab =
    rawTab === "wishlist" ? "wishlist" : "orders";

  return (
    <div className="px-3 mt-6 -mx-4 bg-white border border-gray-200 rounded-lg shadow-sm md:px-3 md:mx-0">
      <div className="flex text-xs border-b border-gray-100">
        <Link
          to="/account?tabs=orders"
          className={`flex-1 py-2 font-medium text-center ${
            activeTab === "orders" ? "border-b border-black" : ""
          }`}
        >
          Orders
        </Link>

        <Link
          to="/account?tabs=wishlist"
          className={`flex-1 py-2 font-medium text-center ${
            activeTab === "wishlist" ? "border-b border-black" : ""
          }`}
        >
          Wishlist
        </Link>
      </div>

      <TabsContent tab={activeTab} />
    </div>
  );
};

export default TabsCard;