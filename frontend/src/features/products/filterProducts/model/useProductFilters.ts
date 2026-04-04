import { useMemo, useState } from "react";
import type { Product } from "@/shared/types/typeProduct";

export interface FilterOption {
  label: string;
  value: string;
}

const AVAILABILITY_OPTIONS: FilterOption[] = [
  { label: "All", value: "all" },
  { label: "In Stock", value: "in-stock" },
  { label: "Out of Stock", value: "out-of-stock" },
];

const PRICE_OPTIONS: FilterOption[] = [
  { label: "All Prices", value: "all" },
  { label: "Under Rp 500.000", value: "under-500k" },
  { label: "Rp 500.000 - Rp 5.000.000", value: "500k-5m" },
  { label: "Above Rp 5.000.000", value: "above-5m" },
];

const useProductFilters = (products: Product[]) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedAvailability, setSelectedAvailability] = useState("all");
  const [selectedPriceRange, setSelectedPriceRange] = useState("all");

  const categoryOptions = useMemo<FilterOption[]>(() => {
    const categories = Array.from(new Set(products.map((product) => product.category)));

    return [
      { label: "All Categories", value: "all" },
      ...categories.map((category) => ({
        label: category,
        value: category,
      })),
    ];
  }, [products]);

  const filteredProducts = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return products.filter((product) => {
      const matchSearch =
        !normalizedQuery || product.name.toLowerCase().includes(normalizedQuery);
      const matchCategory =
        selectedCategory === "all" || product.category === selectedCategory;
      const matchAvailability =
        selectedAvailability === "all" ||
        (selectedAvailability === "in-stock" && product.stock > 0) ||
        (selectedAvailability === "out-of-stock" && product.stock <= 0);

      const matchPrice =
        selectedPriceRange === "all" ||
        (selectedPriceRange === "under-500k" && product.price < 500000) ||
        (selectedPriceRange === "500k-5m" &&
          product.price >= 500000 &&
          product.price <= 5000000) ||
        (selectedPriceRange === "above-5m" && product.price > 5000000);

      return matchSearch && matchCategory && matchAvailability && matchPrice;
    });
  }, [
    products,
    searchQuery,
    selectedCategory,
    selectedAvailability,
    selectedPriceRange,
  ]);

  return {
    searchQuery,
    handleSearchQuery: setSearchQuery,
    filteredProducts,
    categoryOptions,
    availabilityOptions: AVAILABILITY_OPTIONS,
    priceOptions: PRICE_OPTIONS,
    selectedCategory,
    selectedAvailability,
    selectedPriceRange,
    handleCategoryChange: setSelectedCategory,
    handleAvailabilityChange: setSelectedAvailability,
    handlePriceRangeChange: setSelectedPriceRange,
  };
};

export default useProductFilters;
