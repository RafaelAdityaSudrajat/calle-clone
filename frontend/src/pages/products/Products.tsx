import LayoutPrimary from "@/widgets/layout/LayoutPrimary";
import SearchProductByName from "@/features/products/searchByName/ui/SearchProductByName";
import useSearchProductByName from "@/features/products/searchByName/model/useSearchProductByName";
import UseTrigger from "@/shared/lib/hooks/CustomHookShare";
import MOCK_PRODUCTS from "@/shared/mocks/mockDataProducts";

import { useState } from "react";
import FilterSortActions from "./FilterSortActions";

import DropdownSort from "../../widgets/products/DropdownSort";
import FilterAndSortPopUp from "./FilterAndSortPopUp";
import SideFilter from "./SideFilter";
import ProductCard from "./ProductCard.";

type ActiveSheet = "filter" | "sort" | null;

const Products = () => {
  const { trigger, handleTrigger } = UseTrigger();
  const [activeSheet, setActiveSheet] = useState<ActiveSheet>(null);
  const { searchQuery, filteredProducts, handleSearchQuery } =
    useSearchProductByName(MOCK_PRODUCTS);

  function handleActiveeSheet(value: ActiveSheet) {
    setActiveSheet(value);
  }

  return (
    <LayoutPrimary>
      <div className="flex gap-4 px-2 lg:py-4">
        {/* side filter */}
        <div className="flex-1 hidden lg:block">
          <SideFilter
            searchQuery={searchQuery}
            handleSearchQuery={handleSearchQuery}
          />
        </div>

        <div className="flex-[4]">
          <div className="mb-4 lg:hidden">
            <SearchProductByName
              searchQuery={searchQuery}
              handleSearchQuery={handleSearchQuery}
              placeholder="Search product name"
            />
          </div>

          {/* header */}
          <div className="mb-4">
            <FilterSortActions
              handleTrigger={handleTrigger}
              handleActiveeSheet={handleActiveeSheet}
            />

            <div className="hidden lg:flex items-center text-[1.3rem] relative my-2">
              <h2 className="flex-1">
                {searchQuery.trim()
                  ? `Hasil pencarian (${filteredProducts.length})`
                  : `All Products (${filteredProducts.length})`}
              </h2>
              <DropdownSort />
            </div>
          </div>

          {/* product list */}
          <div className="w-full">
            {filteredProducts.length > 0 ? (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                {filteredProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    id={product.id}
                    title={product.name}
                    price={product.price}
                  />
                ))}
              </div>
            ) : (
              <div className="py-16 text-center border rounded-lg border-zinc-200">
                <p className="text-lg font-medium text-primary">
                  Product tidak ditemukan
                </p>
                <p className="mt-2 text-sm text-zinc-500">
                  Coba gunakan nama product yang lain.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <FilterAndSortPopUp
        trigger={trigger}
        handleTrigger={handleTrigger}
        activeSheet={activeSheet}
      />
    </LayoutPrimary>
  );
};

export default Products;
