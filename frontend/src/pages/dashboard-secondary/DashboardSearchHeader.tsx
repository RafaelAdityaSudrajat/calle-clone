import { HiOutlineSearch } from "react-icons/hi";

const DashboardSearchHeader = () => {
  return (
    <>
      <HiOutlineSearch className="absolute text-xl -translate-y-1/2 left-4 top-1/2 text-slate-400" />
      <input
        type="search"
        placeholder="Search..."
        className="w-full py-3.5 pl-12 pr-4 text-[15px] border border-slate-200 rounded-xl focus:outline-none focus:border-[#22a447] focus:ring-2 focus:ring-[#22a447]/20 placeholder:text-slate-400/80 bg-slate-50"
      />
    </>
  );
};

export default DashboardSearchHeader;
