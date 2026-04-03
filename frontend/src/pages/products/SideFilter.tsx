import SearchProductByName from "@/features/products/searchByName/ui/SearchProductByName";
import DropDownMenu from "../../widgets/products/DropDownMenu";

interface SideFilterProps {
  searchQuery: string;
  handleSearchQuery: (value: string) => void;
}

const SideFilter = ({
  searchQuery,
  handleSearchQuery,
}: SideFilterProps) => {
  return (
    <div className="w-full">
      <div className="border rounded-lg border-zinc-200">
        <div className="border-b border-zinc-200">
          <SearchProductByName
            searchQuery={searchQuery}
            handleSearchQuery={handleSearchQuery}
            placeholder="Search product name"
          />
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
