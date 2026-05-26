import DashboardLayout from "../../../../widgets/dashboard/AdminLayout";
import DashboardAdvancedListHome from "./DashboardAdvancedListHome";
import StatList from "./StatList";

const DashboardHome = () => {


  return (
    <DashboardLayout>
      <div className="mb-6 space-y-1 font-extralight text-dashboardTextPrimary">
        <h2>Dashboard</h2>
        <h3>Your Main Content Goes Here ...</h3>
      </div>

      <StatList />
      <DashboardAdvancedListHome />
    </DashboardLayout>
  );
};

export default DashboardHome;
