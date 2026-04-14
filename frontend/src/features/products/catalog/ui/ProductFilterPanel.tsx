import type { FilterOption } from "../model/types";
import FilterAccordion from "./FilterAccordion";
import ProductSearchInput from "./ProductSearchInput";

interface ProductFilterPanelProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  categoryOptions: FilterOption[];
  availabilityOptions: FilterOption[];
  priceOptions: FilterOption[];
  sizeOptions: FilterOption[];
  selectedCategory: string;
  selectedAvailability: string;
  selectedPriceRange: string;
  selectedSize: string;
  onCategoryChange: (value: string) => void;
  onAvailabilityChange: (value: string) => void;
  onPriceRangeChange: (value: string) => void;
  onSizeChange: (value: string) => void;
  onReset: () => void;
  showSearch?: boolean;
}

const ProductFilterPanel = ({
  searchQuery,
  onSearchChange,
  categoryOptions,
  availabilityOptions,
  priceOptions,
  sizeOptions,
  selectedCategory,
  selectedAvailability,
  selectedPriceRange,
  selectedSize,
  onCategoryChange,
  onAvailabilityChange,
  onPriceRangeChange,
  onSizeChange,
  onReset,
  showSearch = true,
}: ProductFilterPanelProps) => {
  return (
    <div className="w-full border rounded-lg border-zinc-200">
      {showSearch && (
        <div className="border-b border-zinc-200">
          <ProductSearchInput
            searchQuery={searchQuery}
            onSearchChange={onSearchChange}
            placeholder="Search product name"
          />
        </div>
      )}

      <FilterAccordion
        label="Category"
        options={categoryOptions}
        selectedValue={selectedCategory}
        onChange={onCategoryChange}
      />
      <FilterAccordion
        label="Availability"
        options={availabilityOptions}
        selectedValue={selectedAvailability}
        onChange={onAvailabilityChange}
      />
      <FilterAccordion
        label="Price"
        options={priceOptions}
        selectedValue={selectedPriceRange}
        onChange={onPriceRangeChange}
      />
      <FilterAccordion
        label="Size"
        options={sizeOptions}
        selectedValue={selectedSize}
        onChange={onSizeChange}
      />

      <div className="flex justify-end px-4 py-3">
        <button
          type="button"
          onClick={onReset}
          className="text-sm font-medium underline transition-colors text-zinc-500 hover:text-zinc-900"
        >
          Reset filters
        </button>
      </div>
    </div>
  );
};

export default ProductFilterPanel;
