import { IoMdClose } from "react-icons/io";

import BackDrop from "@/shared/ui/BackDrop";
import ProductFilterPanel from "@/widgets/products/ProductFilterPanel";
import ProductSortSheet from "@/features/products/catalog/ui/ProductSortSheet";
import type {
  FilterOption,
  ProductSortValue,
} from "@/features/products/catalog/model/types";

type ActiveSheet = "filter" | "sort" | null;

interface ProductCatalogSheetProps {
  activeSheet: ActiveSheet;
  onClose: () => void;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  categoryOptions: FilterOption[];
  availabilityOptions: FilterOption[];
  priceOptions: FilterOption[];
  sizeOptions: FilterOption[];
  sortOptions: FilterOption[];
  selectedCategory: string;
  selectedAvailability: string;
  selectedPriceRange: string;
  selectedSize: string;
  selectedSort: ProductSortValue;
  onCategoryChange: (value: string) => void;
  onAvailabilityChange: (value: string) => void;
  onPriceRangeChange: (value: string) => void;
  onSizeChange: (value: string) => void;
  onSortChange: (value: ProductSortValue) => void;
  onReset: () => void;
}

const ProductCatalogSheet = ({
  activeSheet,
  onClose,
  searchQuery,
  onSearchChange,
  categoryOptions,
  availabilityOptions,
  priceOptions,
  sizeOptions,
  sortOptions,
  selectedCategory,
  selectedAvailability,
  selectedPriceRange,
  selectedSize,
  selectedSort,
  onCategoryChange,
  onAvailabilityChange,
  onPriceRangeChange,
  onSizeChange,
  onSortChange,
  onReset,
}: ProductCatalogSheetProps) => {
  const isOpen = activeSheet !== null;
  const title =
    activeSheet === "filter" ? "Filter Products" : "Sort Products";

  return (
    <BackDrop trigger={isOpen} onClose={onClose}>
      <div
        className={`absolute bottom-0 right-1/2 w-[95%] max-w-[30rem] translate-x-1/2 overflow-y-auto rounded-t-3xl border border-zinc-200 bg-white transition-transform duration-300 md:bottom-[50%] md:max-h-[80vh] md:translate-y-[50%] md:rounded-3xl ${
          isOpen ? "translate-y-0" : "translate-y-full"
        }`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-4 bg-white border-b border-zinc-200">
          <h2 className="text-lg font-medium text-primary">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 transition-colors rounded-full text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
          >
            <IoMdClose className="text-xl" />
          </button>
        </div>

        <div className="p-4">
          {activeSheet === "filter" && (
            <ProductFilterPanel
              searchQuery={searchQuery}
              onSearchChange={onSearchChange}
              categoryOptions={categoryOptions}
              availabilityOptions={availabilityOptions}
              priceOptions={priceOptions}
              sizeOptions={sizeOptions}
              selectedCategory={selectedCategory}
              selectedAvailability={selectedAvailability}
              selectedPriceRange={selectedPriceRange}
              selectedSize={selectedSize}
              onCategoryChange={onCategoryChange}
              onAvailabilityChange={onAvailabilityChange}
              onPriceRangeChange={onPriceRangeChange}
              onSizeChange={onSizeChange}
              onReset={onReset}
            />
          )}

          {activeSheet === "sort" && (
            <ProductSortSheet
              options={sortOptions}
              selectedValue={selectedSort}
              onChange={(value) => {
                onSortChange(value);
                onClose();
              }}
            />
          )}
        </div>
      </div>
    </BackDrop>
  );
};

export default ProductCatalogSheet;
