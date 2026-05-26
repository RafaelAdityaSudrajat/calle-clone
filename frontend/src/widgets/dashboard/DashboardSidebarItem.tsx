// Reusable Sidebar Item Component

import { Link } from "react-router-dom";
import type { MenuItem } from "../../pages/dashboard-secondary/type/type-menu-item";

const DashboardSidebarItem = ({
  icon: Icon,
  label,
  isActive = false,
  href,
}: MenuItem) => {

  console.log(href)
  return (
    <Link to={href}>
      <div
        className={`
        flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer transition-all duration-200
        ${
          isActive
            ? "bg-dashboardPrimary text-white shadow-md"
            : "text-dashboardTextPrimary hover:bg-slate-100"
        }
      `}
      >
        <Icon
          className={`text-xl ${isActive ? "text-white" : "text-slate-600"}`}
        />
        <span className="text-xs font-medium">{label}</span>
      </div>
    </Link>
  );
};

export default DashboardSidebarItem;
