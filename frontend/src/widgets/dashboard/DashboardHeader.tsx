import { HiOutlineMenu, HiOutlineUser } from "react-icons/hi";
import { RiArrowDropDownLine } from "react-icons/ri";

import DashboardSearchHeader from "../../entities/dashboard/ui/DashboardSearchHeader";

// Komponen Header/Topbar yang berdiri sendiri
const DashboardHeader = () => {
  return (
    <header className="sticky top-0 left-0 w-full py-5 font-sans bg-white border-b shadow-sm border-slate-100">
      {/* Baris Atas: Menu Hamburger dan Profil */}
      <div className="flex items-center justify-between gap-3">
        {/* Ikon Menu Hamburger di kiri */}
        <div className="flex items-center gap-3">
          <HiOutlineMenu
            className="text-[26px] text-slate-700 cursor-pointer hover:text-slate-900 transition-colors lg:hidden"
            aria-label="Toggle Sidebar"
          />
          <div className="relative hidden lg:block">
            <DashboardSearchHeader />
          </div>
        </div>

        {/* Kontainer Ikon Profil di kanan dengan warna hijau yang serasi */}
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-8 h-8 bg-dashboardPrimary rounded-full shadow-md cursor-pointer hover:bg-[#1e8d3c] transition-colors">
            <HiOutlineUser className="text-white text-medium" />
          </div>
          <div className="items-center hidden text-sm md:flex">
            <p className="">Account</p>

            <RiArrowDropDownLine className="text-3xl text-black" />
          </div>
        </div>
      </div>

      {/* Baris Bawah: Kolom Input Pencarian yang membentang penuh */}
      <div className="relative w-full mt-6 lg:hidden">
        {/* Ikon Kaca Pembesar di dalam input */}
        <DashboardSearchHeader />
      </div>
    </header>
  );
};

export default DashboardHeader;
