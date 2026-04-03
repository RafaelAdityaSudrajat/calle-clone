import DropDownMenu from "../../widgets/products/DropDownMenu";

interface FilterProps {
  trigger: boolean;
}

const Filter = ({ trigger }: FilterProps) => {
  return (
    <div className="p-3 mt-8">
      {/* Product Type */}
      <DropDownMenu
        trigger={trigger}
        label="Product Type"
        value={["Laptop", "Phone", "Tablet"]}
      />

      <DropDownMenu
        trigger={trigger}
        label="Availabilty"
        value={["All", "In Stock"]}
      />

      <DropDownMenu
        trigger={trigger}
        label="Price"
        value={["Rp 600.000", "Rp 1.000.000", "Rp 1.500.000"]}
      />

      {/* sizeee */}

      <div className="py-4">
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

      {/* ... bagian lain tetap ... */}
      <div className="sticky w-full bottom-5">
        <div className="flex items-center justify-center">
          <button className="w-full py-2 text-white bg-black rounded-xl">
            Apply
          </button>
        </div>
      </div>
    </div>
  );
};

export default Filter;
