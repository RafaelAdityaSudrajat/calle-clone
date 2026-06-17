// Reusable Sidebar Item Component

import { Link } from "react-router-dom";
import type { MenuItem } from "../../../pages/dashboard/type/type-menu-item";

const DashboardSidebarItem = ({
  icon: Icon,
  label,
  active = false,
  href,
}: MenuItem) => {
  return (
    <Link to={href}>
      <div
        className={`
        flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer transition-all duration-200
        ${
          active
            ? "bg-dashboardPrimary text-white shadow-md"
            : "text-dashboardTextPrimary hover:bg-slate-100"
        }
      `}
      >
        <Icon
          className={`text-xl ${active ? "text-white" : "text-slate-600"}`}
        />
        <span className="text-xs font-medium">{label}</span>
      </div>
    </Link>
  );
};

export default DashboardSidebarItem;
