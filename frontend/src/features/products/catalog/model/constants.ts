import type { FilterOption } from "./types";

export const AVAILABILITY_OPTIONS: FilterOption[] = [
  { label: "All", value: "all" },
  { label: "In Stock", value: "in-stock" },
  { label: "Out of Stock", value: "out-of-stock" },
];

export const PRICE_OPTIONS: FilterOption[] = [
  { label: "All Prices", value: "all" },
  { label: "Under Rp 500.000", value: "under-500k" },
  { label: "Rp 500.000 - Rp 5.000.000", value: "500k-5m" },
  { label: "Above Rp 5.000.000", value: "above-5m" },
];

export const SORT_OPTIONS: FilterOption[] = [
  { label: "Featured", value: "featured" },
  { label: "Price: Low to High", value: "price-low-high" },
  { label: "Price: High to Low", value: "price-high-low" },
  { label: "Name: A to Z", value: "name-a-z" },
  { label: "Stock: High to Low", value: "stock-high-low" },
];

