import type { ReactNode } from "react";
import {
  HiOutlineViewGrid,
  HiOutlineUsers,
  HiOutlineOfficeBuilding,
  HiOutlineTrendingUp,
  HiOutlineClipboardCheck,
  HiOutlineChartBar,
  HiOutlineCreditCard,
  HiOutlineCog,
  HiOutlineDocumentText,
} from "react-icons/hi";
import type { MenuItem } from "./type/type-menu-item";
import DashboardSideNav from "./DashboardSideNav";
import DashboardHeader from "./DashboardHeader";

interface DashboardLayoutProps {
  children: ReactNode;
}

const AdminLayout = ({ children }: DashboardLayoutProps) => {
  const menuItems: MenuItem[] = [
    { icon: HiOutlineViewGrid, label: "Dashboard", active: true },
    { icon: HiOutlineUsers, label: "Contacts" },
    { icon: HiOutlineOfficeBuilding, label: "Companies" },
    { icon: HiOutlineTrendingUp, label: "Deals" },
    { icon: HiOutlineClipboardCheck, label: "Tasks" },
    { icon: HiOutlineChartBar, label: "Reports" },
    { icon: HiOutlineCreditCard, label: "Billing" },
    { icon: HiOutlineCog, label: "Settings" },
    { icon: HiOutlineDocumentText, label: "Docs" },
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
