import DashboardSidebarItem from "./DashboardSidebarItem";
import { HiChevronLeft } from "react-icons/hi";
import type { MenuItem } from "./type/type-menu-item";

interface DashboardSidebarItemProps {
  menuItems: MenuItem[];
}

const DashboardSideNav = ({ menuItems }: DashboardSidebarItemProps) => {
  return (
    <aside className="sticky top-0 left-0 flex flex-col h-screen font-sans bg-white border-r border-slate-200">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-8 mb-2">
        <h1 className="text-sm font-bold tracking-tight text-slate-800">
          Material Shadcn Vue
        </h1>
        <HiChevronLeft className="text-xl cursor-pointer text-slate-500 hover:text-slate-800" />
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 px-3">
        {menuItems.map((item, index) => (
          <DashboardSidebarItem
            key={index}
            icon={item.icon}
            label={item.label}
            href={item.href}
            isActive={item.active}
          />
        ))}
      </nav>
    </aside>
  );
};

export default DashboardSideNav;
