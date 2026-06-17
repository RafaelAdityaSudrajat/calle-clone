import DashboardSidebarItem from "../../entities/dashboard/ui/DashboardSidebarItem";
import { HiChevronLeft } from "react-icons/hi";
import type { MenuItem } from "../../pages/dashboard/type/type-menu-item";

interface DashboardSidebarItemProps {
  menuItems: MenuItem[];
}

const DashboardSideNav = ({ menuItems }: DashboardSidebarItemProps) => {
  return (
    <aside className="sticky top-0 left-0 flex flex-col h-screen font-sans bg-white border-r border-slate-200">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-8 mb-2">
        <h2 className="text-lg font-bold tracking-tight text-slate-800">
          Calle
        </h2>
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
            active={item.active}
          />
        ))}
      </nav>
    </aside>
  );
};

export default DashboardSideNav;
