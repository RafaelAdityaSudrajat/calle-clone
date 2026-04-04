import SearchProductByName from "@/features/products/searchByName/ui/SearchProductByName";
import type { FilterOption } from "@/features/products/filterProducts/model/useProductFilters";
import DropDownMenu from "../../widgets/products/DropDownMenu";

interface SideFilterProps {
  searchQuery: string;
  handleSearchQuery: (value: string) => void;
  categoryOptions: FilterOption[];
  availabilityOptions: FilterOption[];
  priceOptions: FilterOption[];
  selectedCategory: string;
  selectedAvailability: string;
  selectedPriceRange: string;
  handleCategoryChange: (value: string) => void;
  handleAvailabilityChange: (value: string) => void;
  handlePriceRangeChange: (value: string) => void;
}

const SideFilter = ({
  searchQuery,
  handleSearchQuery,
  categoryOptions,
  availabilityOptions,
  priceOptions,
  selectedCategory,
  selectedAvailability,
  selectedPriceRange,
  handleCategoryChange,
  handleAvailabilityChange,
  handlePriceRangeChange,
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
            label="Category"
            value={categoryOptions}
            selectedValue={selectedCategory}
            onChange={handleCategoryChange}
          />

          <DropDownMenu
            trigger={true}
            label="Availability"
            value={availabilityOptions}
            selectedValue={selectedAvailability}
            onChange={handleAvailabilityChange}
          />

          <DropDownMenu
            trigger={true}
            label="Price"
            value={priceOptions}
            selectedValue={selectedPriceRange}
            onChange={handlePriceRangeChange}
          />
        </div>
      </div>
    </div>
  );
};

export default SideFilter;
