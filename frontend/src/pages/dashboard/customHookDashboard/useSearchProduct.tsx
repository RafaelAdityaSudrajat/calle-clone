import { useState } from "react";
import type { Product } from "@/entities/product";

const useSearchProduct = (products: Product[]) => {
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearchQuery = (value: string) => {
    setSearchQuery(value);
  };

  const filteredProducts = products.filter(
    (product) =>
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.category.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return { handleSearchQuery, filteredProducts, searchQuery };
};

export default useSearchProduct;
