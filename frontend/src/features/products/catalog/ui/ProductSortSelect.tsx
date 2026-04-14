import type { FilterOption, ProductSortValue } from "../model/types";

interface ProductSortSelectProps {
  options: FilterOption[];
  value: ProductSortValue;
  onChange: (value: ProductSortValue) => void;
}

const ProductSortSelect = ({
  options,
  value,
  onChange,
}: ProductSortSelectProps) => {
  return (
    <label className="flex items-center gap-3 text-sm text-zinc-600">
      <span>Sort</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as ProductSortValue)}
        className="px-4 py-2 text-sm bg-white border rounded-md outline-none border-zinc-200 text-primary"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
};

export default ProductSortSelect;

