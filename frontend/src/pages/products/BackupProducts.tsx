import LayoutPrimary from "@/widgets/layout/LayoutPrimary";
import { CiSearch } from "react-icons/ci";
import { FaChevronUp } from "react-icons/fa";

const Products = () => {
  return (
    <LayoutPrimary>
      <div className="w-full px-10 py-5">
        <div className="flex w-full gap-5">
          <div className="flex-1">
            <div className="bg-white border rounded-xl border-zinc-200">
              {/* Search */}
              <div className="p-3 border-b border-zinc-200">
                <div className="relative">
                  <CiSearch className="absolute w-5 h-5 font-semibold -translate-y-1/2 pointer-events-none left-3 top-1/2" />

                  <input
                    type="text"
                    placeholder="Search"
                    className="w-full py-3 pl-10 pr-3 text-sm font-medium bg-white border rounded-lg border-zinc-200 text-zinc-900 placeholder:text-zinc-500 focus:border-zinc-200 focus:outline-none focus:ring-0"
                  />
                </div>
              </div>

              <div className="p-3">
                {/* Product Type */}
                <div className="pb-4 border-b border-zinc-200">
                  <button
                    type="button"
                    className="flex items-center justify-between w-full py-2"
                  >
                    <span className="text-xs text-primary">Product Type</span>
                    <FaChevronUp className="w-3 h-3" />
                  </button>

                  <div className="mt-2 space-y-2">
                    <label className="flex cursor-pointer items-center gap-2 text-[12px] font-medium text-primary">
                      <span className="grid w-4 h-4 border rounded-full place-items-center border-zinc-400">
                        <span className="w-2 h-2 rounded-full bg-zinc-900" />
                      </span>
                      All Products
                    </label>

                    <label className="flex cursor-pointer items-center gap-2 text-[12px] font-medium text-primary">
                      <span className="grid w-4 h-4 border rounded-full place-items-center border-zinc-400">
                        <span className="w-2 h-2 bg-transparent rounded-full" />
                      </span>
                      Featured Products
                    </label>
                  </div>
                </div>

                {/* Availability */}
                <div className="py-4 border-b border-zinc-200">
                  <button
                    type="button"
                    className="flex items-center justify-between w-full py-2"
                  >
                    <span className="text-xs text-primary">Availability</span>
                    <div className="w-4 h-4 rounded bg-zinc-300" />
                  </button>

                  <div className="mt-2 space-y-2">
                    <label className="flex cursor-pointer items-center gap-2 text-[12px] font-medium text-primary">
                      <span className="grid w-4 h-4 border rounded-full place-items-center border-zinc-400">
                        <span className="w-2 h-2 rounded-full bg-zinc-900" />
                      </span>
                      All
                    </label>

                    <label className="flex cursor-pointer items-center gap-2 text-[12px] font-medium text-primary">
                      <span className="grid w-4 h-4 border rounded-full place-items-center border-zinc-400">
                        <span className="w-2 h-2 bg-transparent rounded-full" />
                      </span>
                      In Stock
                    </label>
                  </div>
                </div>

                {/* Price */}
                <div className="py-4 border-b border-zinc-200">
                  <button
                    type="button"
                    className="flex items-center justify-between w-full py-2"
                  >
                    <span className="text-xs text-primary">Price</span>
                    <div className="w-4 h-4 rounded bg-zinc-300" />
                  </button>

                  <div className="mt-2 space-y-2">
                    <label className="flex cursor-pointer items-center gap-2 text-[12px] font-medium text-primary">
                      <span className="grid w-4 h-4 border rounded-full place-items-center border-zinc-400">
                        <span className="w-2 h-2 bg-transparent rounded-full" />
                      </span>
                      Under Rp 620,000
                    </label>

                    <label className="flex cursor-pointer items-center gap-2 text-[12px] font-medium text-primary">
                      <span className="grid w-4 h-4 border rounded-full place-items-center border-zinc-400">
                        <span className="w-2 h-2 bg-transparent rounded-full" />
                      </span>
                      Rp Rp 620,000 - Rp 1,200,000
                    </label>

                    <label className="flex cursor-pointer items-center gap-2 text-[12px] font-medium text-primary">
                      <span className="grid w-4 h-4 border rounded-full place-items-center border-zinc-400">
                        <span className="w-2 h-2 bg-transparent rounded-full" />
                      </span>
                      Rp Rp 1,200,000 - Rp 1,800,000
                    </label>

                    <label className="flex cursor-pointer items-center gap-2 text-[12px] font-medium text-primary">
                      <span className="grid w-4 h-4 border rounded-full place-items-center border-zinc-400">
                        <span className="w-2 h-2 bg-transparent rounded-full" />
                      </span>
                      Rp 1,800,000 +
                    </label>
                  </div>
                </div>

                {/* Size */}
                <div className="pt-4">
                  <button
                    type="button"
                    className="flex items-center justify-between w-full py-2"
                  >
                    <span className="text-xs text-primary">Size</span>
                    <div className="w-4 h-4 rounded bg-zinc-300" />
                  </button>

                  <div className="flex flex-wrap gap-2 mt-2">
                    <button
                      type="button"
                      className="h-8 min-w-9 rounded-md border border-zinc-200 bg-white px-3 text-[11px] text-primary"
                    >
                      S
                    </button>
                    <button
                      type="button"
                      className="h-8 min-w-9 rounded-md border border-zinc-200 bg-white px-3 text-[11px] text-primary"
                    >
                      M
                    </button>
                    <button
                      type="button"
                      className="h-8 min-w-9 rounded-md border border-zinc-200 bg-white px-3 text-[11px] text-primary"
                    >
                      L
                    </button>
                    <button
                      type="button"
                      className="h-8 min-w-9 rounded-md border border-zinc-200 bg-white px-3 text-[11px] text-primary"
                    >
                      XL
                    </button>
                    <button
                      type="button"
                      className="h-8 min-w-9 rounded-md border border-zinc-200 bg-white px-3 text-[11px] text-primary"
                    >
                      XXL
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="h-screen flex-[4]">R</div>
        </div>
      </div>
    </LayoutPrimary>
  );
};

export default Products;
