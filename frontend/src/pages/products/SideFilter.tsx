import DropDownMenu from "../../components/products/DropDownMenu";
import { IoSearchOutline } from "react-icons/io5";

const SideFilter = () => {
  return (
    <div className="w-full">
      <div className="border rounded-lg border-zinc-200">
        <div className="border-b border-zinc-200">
          <div className="flex items-center gap-2 px-2 py-3 m-2 border border-zinc-200 rounded-2xl">
            <IoSearchOutline className="text-[1.3rem]" />
            <input
              type="text"
              placeholder="Search"
              className="placeholder:text-[.9rem] placeholder:text-zinc-500 outline-none"
            />
          </div>
        </div>

        <div className="">
          <DropDownMenu
            trigger={true}
            label="Product Type"
            value={["Laptop", "Phone", "Tablet"]}
          />

          <DropDownMenu
            trigger={true}
            label="Availabilty"
            value={["All", "In Stock"]}
          />

          <DropDownMenu
            trigger={true}
            label="Price"
            value={["Rp 600.000", "Rp 1.000.000", "Rp 1.500.000"]}
          />
        </div>
      </div>
    </div>
  );
};

export default SideFilter;
