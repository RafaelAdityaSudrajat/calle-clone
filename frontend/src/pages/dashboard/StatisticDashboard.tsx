import CardDashboardSecondary from "../../widgets/dashboardSecondary/CardDashboardSecondary";
import MOCK_PRODUCTS from "@/shared/mocks/mockDataProducts";
import { getProductStatistics } from "@/shared/lib/statisticProduct";

const StatisticDashboard = () => {
  const { total, categories, lowStock } = getProductStatistics(MOCK_PRODUCTS);

  return (
    <div className="grid grid-cols-1 gap-6 mb-8 md:grid-cols-3">
      <CardDashboardSecondary className="p-6">
        <div className="mb-2 text-sm font-medium text-gray-400">
          Total Products
        </div>
        <div className="text-3xl font-bold text-white">{total}</div>
      </CardDashboardSecondary>
      <CardDashboardSecondary className="p-6">
        <div className="mb-2 text-sm font-medium text-gray-400">Categories</div>
        <div className="text-3xl font-bold text-white">{categories}</div>
      </CardDashboardSecondary>
      <CardDashboardSecondary className="p-6">
        <div className="mb-2 text-sm font-medium text-gray-400">
          Low Stock Items
        </div>
        <div className="text-3xl font-bold text-red-400">{lowStock}</div>
      </CardDashboardSecondary>
    </div>
  );
};

export default StatisticDashboard;
