import type { ReactNode } from "react";
import {
  HiOutlineViewGrid,
  HiOutlineOfficeBuilding,
  HiOutlineTrendingUp,
  HiOutlineClipboardCheck,
  HiOutlineChartBar,
  HiOutlineCreditCard,
  HiOutlineCog,
  HiOutlineDocumentText,
} from "react-icons/hi";
import { FiPlus } from "react-icons/fi";
import type { MenuItem } from "./type/type-menu-item";
import DashboardSideNav from "./DashboardSideNav";
import DashboardHeader from "./DashboardHeader";

interface DashboardLayoutProps {
  children: ReactNode;
}

const AdminLayout = ({ children }: DashboardLayoutProps) => {
  const menuItems: MenuItem[] = [
    { icon: HiOutlineViewGrid, label: "Dashboard", active: true, href: "/dashboard-secondary" },
    { icon: FiPlus, label: "Add Product", href: "/dashboard-secondary/product" },
  ];

  return (
    <div className="flex max-w-screen">
      <div className="flex-1 hidden lg:block">
        <DashboardSideNav menuItems={menuItems} />
      </div>
      <div className="flex-[4] px-6">
        <DashboardHeader />
        <div className="py-5">{children}</div>
      </div>
    </div>
  );
};

export default AdminLayout;
