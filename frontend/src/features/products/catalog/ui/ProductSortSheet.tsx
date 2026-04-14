import type { FilterOption, ProductSortValue } from "../model/types";

interface ProductSortSheetProps {
  options: FilterOption[];
  selectedValue: ProductSortValue;
  onChange: (value: ProductSortValue) => void;
}

const ProductSortSheet = ({
  options,
  selectedValue,
  onChange,
}: ProductSortSheetProps) => {
  return (
    <div className="space-y-2">
      {options.map((option) => {
        const isActive = option.value === selectedValue;

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value as ProductSortValue)}
            className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors ${
              isActive
                ? "border-primary bg-zinc-100 text-primary"
                : "border-zinc-200 text-zinc-600"
            }`}
          >
            <span>{option.label}</span>
            <span
              className={`h-3 w-3 rounded-full ${
                isActive ? "bg-primary" : "bg-zinc-200"
              }`}
            />
          </button>
        );
      })}
    </div>
  );
};

export default ProductSortSheet;

