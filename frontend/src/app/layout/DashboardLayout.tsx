import type { ReactNode } from "react";
import {
  HiOutlineViewGrid,
} from "react-icons/hi";
import { FiPlus } from "react-icons/fi";
import type { MenuItem } from "../../pages/dashboard/type/type-menu-item";
import DashboardSideNav from "../../widgets/dashboard/DashboardSideNav";
import DashboardHeader from "../../widgets/dashboard/DashboardHeader";

interface DashboardLayoutProps {
  children: ReactNode;
}

const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  const menuItems: MenuItem[] = [
    {
      icon: HiOutlineViewGrid,
      label: "Dashboard",
      active: true,
      href: "/dashboard",
    },
    { icon: FiPlus, label: "Add Product", href: "/dashboard/product" },
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

export default DashboardLayout;
