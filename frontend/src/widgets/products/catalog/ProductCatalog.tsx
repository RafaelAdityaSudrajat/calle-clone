import { useEffect, useState } from "react";
import { FaSortAmountDown } from "react-icons/fa";
import { IoFilterSharp } from "react-icons/io5";

import { ProductCard } from "@/entities/product";
import useProductCatalog from "@/features/products/catalog/model/useProductCatalog";
import ProductFilterPanel from "@/widgets/products/ProductFilterPanel";
import ProductSearchInput from "@/features/products/catalog/ui/ProductSearchInput";
import ProductSortSelect from "@/features/products/catalog/ui/ProductSortSelect";

import ProductCatalogSheet from "./ProductCatalogSheet";
import { useProducts } from "@/entities/product/hooks/use-products";

type ActiveSheet = "filter" | "sort" | null;

const ProductCatalog = () => {
  const [activeSheet, setActiveSheet] = useState<ActiveSheet>(null);
  const { data, isLoading, isError } = useProducts();
  const products = data ?? [];

  const {
    searchQuery,
    setSearchQuery,
    selectedCategory,
    setSelectedCategory,
    selectedAvailability,
    setSelectedAvailability,
    selectedPriceRange,
    setSelectedPriceRange,
    selectedSize,
    setSelectedSize,
    selectedSort,
    setSelectedSort,
    categoryOptions,
    availabilityOptions,
    priceOptions,
    sizeOptions,
    sortOptions,
    filteredProducts,
    resetFilters,
  } = useProductCatalog(products);

  useEffect(() => {
    document.body.style.overflow = activeSheet ? "hidden" : "auto";

    return () => {
      document.body.style.overflow = "auto";
    };
  }, [activeSheet]);

  if (isLoading)
    return <div className="py-10 text-center">Loading products...</div>;
  if (isError)
    return (
      <div className="py-10 text-center">
        Gagal memuat produk. Coba lagi sebentar.
      </div>
    );

  return (
    <>
      <div className="flex gap-4 px-2 lg:py-4">
        <aside className="hidden lg:block lg:flex-1">
          <ProductFilterPanel
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            categoryOptions={categoryOptions}
            availabilityOptions={availabilityOptions}
            priceOptions={priceOptions}
            sizeOptions={sizeOptions}
            selectedCategory={selectedCategory}
            selectedAvailability={selectedAvailability}
            selectedPriceRange={selectedPriceRange}
            selectedSize={selectedSize}
            onCategoryChange={setSelectedCategory}
            onAvailabilityChange={setSelectedAvailability}
            onPriceRangeChange={setSelectedPriceRange}
            onSizeChange={setSelectedSize}
            onReset={resetFilters}
          />
        </aside>

        <section className="flex-[4]">
          <div className="mb-4 lg:hidden">
            <ProductSearchInput
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              placeholder="Search product name"
            />
          </div>

          <div className="mb-4">
            <div className="flex w-full gap-3 my-4 px-padding_primary lg:hidden">
              <button
                type="button"
                className="flex items-center justify-center flex-1 gap-2 px-6 py-2 border rounded-xl border-primary"
                onClick={() => setActiveSheet("filter")}
              >
                <IoFilterSharp />
                <span>Filter</span>
              </button>

              <button
                type="button"
                className="flex items-center justify-center flex-1 gap-2 px-6 py-2 border rounded-xl border-primary"
                onClick={() => setActiveSheet("sort")}
              >
                <FaSortAmountDown />
                <span>Sort</span>
              </button>
            </div>

            <div className="relative my-2 hidden items-center text-[1.3rem] lg:flex">
              <h2 className="flex-1">
                {searchQuery.trim()
                  ? `Hasil pencarian (${filteredProducts.length})`
                  : `All Products (${filteredProducts.length})`}
              </h2>
              <ProductSortSelect
                options={sortOptions}
                value={selectedSort}
                onChange={setSelectedSort}
              />
            </div>

            <div className="px-padding_primary lg:hidden">
              <h2 className="text-lg font-medium text-primary">
                {searchQuery.trim()
                  ? `Hasil pencarian (${filteredProducts.length})`
                  : `All Products (${filteredProducts.length})`}
              </h2>
            </div>
          </div>

          <div className="w-full">
            {filteredProducts.length > 0 ? (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                {filteredProducts.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            ) : (
              <div className="py-16 text-center border rounded-lg border-zinc-200">
                <p className="text-lg font-medium text-primary">
                  Product tidak ditemukan
                </p>
                <p className="mt-2 text-sm text-zinc-500">
                  Coba gunakan kata kunci atau filter yang lain.
                </p>
              </div>
            )}
          </div>
        </section>
      </div>

      <ProductCatalogSheet
        activeSheet={activeSheet}
        onClose={() => setActiveSheet(null)}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        categoryOptions={categoryOptions}
        availabilityOptions={availabilityOptions}
        priceOptions={priceOptions}
        sizeOptions={sizeOptions}
        sortOptions={sortOptions}
        selectedCategory={selectedCategory}
        selectedAvailability={selectedAvailability}
        selectedPriceRange={selectedPriceRange}
        selectedSize={selectedSize}
        selectedSort={selectedSort}
        onCategoryChange={setSelectedCategory}
        onAvailabilityChange={setSelectedAvailability}
        onPriceRangeChange={setSelectedPriceRange}
        onSizeChange={setSelectedSize}
        onSortChange={setSelectedSort}
        onReset={resetFilters}
      />
    </>
  );
};

export default ProductCatalog;
