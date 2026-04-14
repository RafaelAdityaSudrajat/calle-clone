import { useMemo, useState } from "react";

import type { Product, ProductSize } from "@/entities/product";

import {
  AVAILABILITY_OPTIONS,
  PRICE_OPTIONS,
  SORT_OPTIONS,
} from "./constants";
import type { FilterOption, ProductSortValue } from "./types";

const DEFAULT_FILTER_VALUE = "all";

const useProductCatalog = (products: Product[]) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(DEFAULT_FILTER_VALUE);
  const [selectedAvailability, setSelectedAvailability] =
    useState(DEFAULT_FILTER_VALUE);
  const [selectedPriceRange, setSelectedPriceRange] =
    useState(DEFAULT_FILTER_VALUE);
  const [selectedSize, setSelectedSize] = useState(DEFAULT_FILTER_VALUE);
  const [selectedSort, setSelectedSort] =
    useState<ProductSortValue>("featured");

  const categoryOptions = useMemo<FilterOption[]>(() => {
    const categories = Array.from(
      new Set(products.map((product) => product.category)),
    );

    return [
      { label: "All Categories", value: DEFAULT_FILTER_VALUE },
      ...categories.map((category) => ({
        label: category,
        value: category,
      })),
    ];
  }, [products]);

  const sizeOptions = useMemo<FilterOption[]>(() => {
    const sizes = Array.from(
      new Set(products.flatMap((product) => product.size)),
    ) as ProductSize[];

    return [
      { label: "All Sizes", value: DEFAULT_FILTER_VALUE },
      ...sizes.map((size) => ({
        label: size,
        value: size,
      })),
    ];
  }, [products]);

  const filteredProducts = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    const nextProducts = products.filter((product) => {
      const matchesSearch =
        !normalizedQuery || product.name.toLowerCase().includes(normalizedQuery);
      const matchesCategory =
        selectedCategory === DEFAULT_FILTER_VALUE ||
        product.category === selectedCategory;
      const matchesAvailability =
        selectedAvailability === DEFAULT_FILTER_VALUE ||
        (selectedAvailability === "in-stock" && product.stock > 0) ||
        (selectedAvailability === "out-of-stock" && product.stock <= 0);
      const matchesPrice =
        selectedPriceRange === DEFAULT_FILTER_VALUE ||
        (selectedPriceRange === "under-500k" && product.price < 500000) ||
        (selectedPriceRange === "500k-5m" &&
          product.price >= 500000 &&
          product.price <= 5000000) ||
        (selectedPriceRange === "above-5m" && product.price > 5000000);
      const matchesSize =
        selectedSize === DEFAULT_FILTER_VALUE ||
        product.size.includes(selectedSize as ProductSize);

      return (
        matchesSearch &&
        matchesCategory &&
        matchesAvailability &&
        matchesPrice &&
        matchesSize
      );
    });

    return [...nextProducts].sort((left, right) => {
      switch (selectedSort) {
        case "price-low-high":
          return left.price - right.price;
        case "price-high-low":
          return right.price - left.price;
        case "name-a-z":
          return left.name.localeCompare(right.name);
        case "stock-high-low":
          return right.stock - left.stock;
        case "featured":
        default:
          return 0;
      }
    });
  }, [
    products,
    searchQuery,
    selectedAvailability,
    selectedCategory,
    selectedPriceRange,
    selectedSize,
    selectedSort,
  ]);

  const resetFilters = () => {
    setSearchQuery("");
    setSelectedCategory(DEFAULT_FILTER_VALUE);
    setSelectedAvailability(DEFAULT_FILTER_VALUE);
    setSelectedPriceRange(DEFAULT_FILTER_VALUE);
    setSelectedSize(DEFAULT_FILTER_VALUE);
    setSelectedSort("featured");
  };

  return {
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
    availabilityOptions: AVAILABILITY_OPTIONS,
    priceOptions: PRICE_OPTIONS,
    sizeOptions,
    sortOptions: SORT_OPTIONS,
    filteredProducts,
    resetFilters,
  };
};

export default useProductCatalog;
