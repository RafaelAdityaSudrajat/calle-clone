import LayoutPrimary from "@/widgets/layout/LayoutPrimary";
import UseTrigger from "@/shared/lib/hooks/CustomHookShare";

import { useState } from "react";
import FilterSortActions from "./FilterSortActions";

import DropdownSort from "../../widgets/products/DropdownSort";
import FilterAndSortPopUp from "./FilterAndSortPopUp";
import SideFilter from "./SideFilter";
import { Link } from "react-router-dom";
import ProductCard from "./ProductCard.";

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
           <ProductCard id={"2"} title={"callee"} price={120000}/>
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
