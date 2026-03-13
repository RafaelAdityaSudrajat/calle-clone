import LayoutPrimary from "../../layout/LayoutPrimary";
import UseTrigger from "../../hooks/CustomHookShare";

import { useState } from "react";
import FilterSortActions from "./FilterSortActions";

import DropdownSort from "../../components/products/DropdownSort";
import FilterAndSortPopUp from "./FilterAndSortPopUp";
import SideFilter from "./SideFilter";
import { Link } from "react-router-dom";

type ActiveSheet = "filter" | "sort" | null;

const Products = () => {
  const { trigger, handleTrigger } = UseTrigger();

  const [activeSheet, setActiveSheet] = useState<ActiveSheet>(null);

  function handleActiveeSheet(value: ActiveSheet) {
    setActiveSheet(value);
  }

  return (
    <LayoutPrimary>
      <div className="flex gap-4 px-2 lg:py-4">
        {/* side filter */}
        <div className="flex-1 hidden lg:block">
          <SideFilter />
        </div>

        <div className="flex-[4]">
          {/* header */}
          <div className="mb-4">
            <FilterSortActions
              handleTrigger={handleTrigger}
              handleActiveeSheet={handleActiveeSheet}
            />

            <div className="hidden lg:flex items-center text-[1.3rem] relative my-2">
              <h2 className="flex-1">All Products</h2>
              <DropdownSort />
            </div>
          </div>

          {/* product list */}
          <div className="w-full">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              <Link to="/products/1">
                <div className="px-3 rounded-md">
                  <div className="flex flex-col p-0">
                    <div className="flex justify-center">
                      <img
                        src="https://d2kchovjbwl1tk.cloudfront.net/vendor/9549/product/1_1766377064172_resized1024-jpg.webp"
                        alt="products 1"
                        className="w-full"
                      />
                    </div>
                    <div className="text-[clamp(.5rem,2vw,.8rem)] text-zinc-800 flex flex-col gap-2 text-start items-center md:items-start md:px-5">
                      <p className="text-center md:text-start">
                        CALLE CREWNECK GRAY
                      </p>
                      <p className="items-start text-center md:text-start">
                        Rp 100.000
                      </p>
                    </div>
                  </div>
                </div>
              </Link>
            </div>
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
