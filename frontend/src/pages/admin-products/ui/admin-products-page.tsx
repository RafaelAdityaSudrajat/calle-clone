import { useState } from "react";
import { Link } from "react-router-dom"; // v7: dari "react-router"
import {
  HiOutlineAdjustmentsHorizontal,
  HiOutlineArrowPath,
  HiOutlineBarsArrowDown,
  HiOutlineChevronDown,
  HiOutlineEllipsisHorizontal,
  HiOutlineListBullet,
  HiOutlineMagnifyingGlass,
  HiOutlinePlus,
  HiOutlineXMark,
} from "react-icons/hi2";
import { useCategories } from "@/entities/category";
import {
  PRODUCT_STATUSES,
  PRODUCT_STATUS_LABELS,
  productStatusSchema,
} from "@/entities/product";
import { useDebouncedCallback } from "@/entities/product/lib/use-debounced-callback";
import { useProductListParams } from "@/pages/admin-products/model/use-product-list-params";
import DashboardLayout from "@/app/layout/DashboardLayout";
import { ProductTable } from "@/widgets/product-table/ui/product-table";

export const AdminProductsPage = () => {
  const { params, setFilter, setPage, resetFilters } = useProductListParams();
  const categories = useCategories();

  // State UI lokal untuk buka/tutup panel filter
  const [isFilterOpen, setIsFilterOpen] = useState(true);

  // Input dikontrol lokal agar ketikan tidak tertahan; URL baru diperbarui setelah jeda 300 ms.
  const [searchInput, setSearchInput] = useState(params.search ?? "");
  const { run: commitSearch, cancel: cancelSearch } = useDebouncedCallback(
    (value: string) => setFilter({ search: value.trim() || undefined }),
    300,
  );

  const activeFilterCount = [
    params.status,
    params.categoryId,
    params.includeDeleted ? "archived" : undefined,
  ].filter(Boolean).length;

  const hasActiveFilters = Boolean(searchInput.trim()) || activeFilterCount > 0;

  return (
    <DashboardLayout>
      <div className="w-full space-y-4">
        {/* Page Title & Primary CTA */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900">
              Produk
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Kelola katalog, status publikasi, dan kategori produk
            </p>
          </div>

          <div className="flex items-center gap-5">
            <Link
              to="/admin/products/create"
              className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-slate-900 text-sm font-medium text-white hover:bg-slate-800 active:scale-[0.99] transition"
            >
              <HiOutlinePlus className="w-4 h-4 stroke-[2]" />
              <span>Tambah produk</span>
            </Link>

            <Link
              to="/admin/products/low-stock"
              className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-slate-900 text-sm font-medium text-white hover:bg-slate-800 active:scale-[0.99] transition"
            >
              Stok menipis
            </Link>
          </div>
        </div>

        {/* Main Toolbar & Filter Wrapper */}
        <form
          role="search"
          onSubmit={(e) => e.preventDefault()}
          className="w-full rounded-xl bg-white border border-slate-200/80 p-3.5 space-y-3.5"
        >
          {/* Top Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Search Input */}
            <div className="flex items-center gap-2.5 w-full sm:max-w-[320px] h-10 px-3.5 rounded-lg bg-[#F5F6F8] focus-within:bg-white focus-within:ring-2 focus-within:ring-slate-900/10 border border-transparent focus-within:border-slate-300 transition">
              <HiOutlineMagnifyingGlass className="w-4 h-4 text-slate-500 shrink-0" />
              <input
                id="search"
                type="search"
                placeholder="Cari nama atau SKU..."
                aria-label="Cari nama atau SKU"
                value={searchInput}
                onChange={(e) => {
                  setSearchInput(e.target.value);
                  commitSearch(e.target.value);
                }}
                className="w-full bg-transparent text-sm text-slate-800 placeholder:text-slate-500 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
              />
              {searchInput && (
                <button
                  type="button"
                  aria-label="Hapus pencarian"
                  onClick={() => {
                    cancelSearch();
                    setSearchInput("");
                    setFilter({ search: undefined });
                  }}
                  className="p-0.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 transition cursor-pointer"
                >
                  <HiOutlineXMark className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Right Action Controls */}
            <div className="flex items-center gap-2 ml-auto shrink-0">
              {/* Combined Filters & Sort Group */}
              <div className="flex items-center h-10 px-1 rounded-lg bg-[#F5F6F8]">
                <button
                  type="button"
                  onClick={() => setIsFilterOpen((prev) => !prev)}
                  aria-expanded={isFilterOpen}
                  className={`inline-flex items-center gap-2 px-3 h-8 rounded-md text-sm font-medium transition-colors cursor-pointer ${
                    isFilterOpen || activeFilterCount > 0
                      ? "bg-white text-slate-900 shadow-2xs"
                      : "text-slate-700 hover:bg-slate-200/60"
                  }`}
                >
                  <span>Filters</span>
                  {activeFilterCount > 0 && (
                    <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-slate-900 text-[11px] font-semibold text-white">
                      {activeFilterCount}
                    </span>
                  )}
                  <HiOutlineAdjustmentsHorizontal className="w-4 h-4 text-slate-600" />
                </button>

                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 px-3 h-8 rounded-md text-sm font-medium text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
                >
                  <span>Sort</span>
                  <HiOutlineBarsArrowDown className="w-4 h-4 text-slate-600" />
                </button>
              </div>

              {/* List View Button */}
              <button
                type="button"
                aria-label="List view"
                className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-[#F5F6F8] text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 transition-colors cursor-pointer"
              >
                <HiOutlineListBullet className="w-4 h-4" />
              </button>

              {/* More Options Button */}
              <button
                type="button"
                aria-label="More options"
                className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-[#F5F6F8] text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 transition-colors cursor-pointer"
              >
                <HiOutlineEllipsisHorizontal className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Collapsible Filter Controls Bar */}
          {isFilterOpen && (
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
              <div className="flex flex-wrap items-center gap-2.5">
                {/* Status Filter */}
                <div className="relative">
                  <label htmlFor="status" className="sr-only">
                    Status
                  </label>
                  <select
                    id="status"
                    value={params.status ?? ""}
                    onChange={(e) => {
                      const parsed = productStatusSchema.safeParse(
                        e.target.value,
                      );
                      setFilter({
                        status: parsed.success ? parsed.data : undefined,
                      });
                    }}
                    className="appearance-none h-9 pl-3.5 pr-9 rounded-lg bg-[#F5F6F8] hover:bg-slate-200/60 text-sm font-medium text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 border border-transparent focus:border-slate-300 transition cursor-pointer"
                  >
                    <option value="">Semua status</option>
                    {PRODUCT_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {PRODUCT_STATUS_LABELS[status]}
                      </option>
                    ))}
                  </select>
                  <HiOutlineChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                </div>

                {/* Category Filter */}
                <div className="relative">
                  <label htmlFor="category" className="sr-only">
                    Kategori
                  </label>
                  <select
                    id="category"
                    value={params.categoryId ?? ""}
                    disabled={categories.isPending}
                    onChange={(e) =>
                      setFilter({ categoryId: e.target.value || undefined })
                    }
                    className="appearance-none h-9 pl-3.5 pr-9 rounded-lg bg-[#F5F6F8] hover:bg-slate-200/60 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 border border-transparent focus:border-slate-300 transition cursor-pointer"
                  >
                    <option value="">
                      {categories.isPending
                        ? "Memuat kategori..."
                        : "Semua kategori"}
                    </option>
                    {categories.data?.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                  <HiOutlineChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                </div>

                {/* Include Archived Checkbox */}
                <label className="inline-flex items-center gap-2 h-9 px-3.5 rounded-lg bg-[#F5F6F8] hover:bg-slate-200/60 text-sm font-medium text-slate-700 select-none transition cursor-pointer">
                  <input
                    type="checkbox"
                    checked={params.includeDeleted ?? false}
                    onChange={(e) =>
                      setFilter({ includeDeleted: e.target.checked })
                    }
                    className="w-4 h-4 rounded cursor-pointer border-slate-300 accent-slate-900"
                  />
                  <span>Tampilkan yang diarsipkan</span>
                </label>
              </div>

              {/* Reset Filter Action */}
              <button
                type="button"
                disabled={!hasActiveFilters}
                onClick={() => {
                  cancelSearch(); // batalkan pencarian yang masih menunggu jeda
                  setSearchInput("");
                  resetFilters();
                }}
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-[#F5F6F8] disabled:opacity-40 disabled:pointer-events-none transition cursor-pointer"
              >
                <HiOutlineArrowPath className="w-3.5 h-3.5" />
                <span>Reset filter</span>
              </button>
            </div>
          )}
        </form>

        <ProductTable params={params} onPageChange={setPage} />
      </div>
    </DashboardLayout>
  );
};
