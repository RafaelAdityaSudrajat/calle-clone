import { useState } from "react";
import type { Product } from "../../../types/typeProduct";




const useSearchProduct = (products : Product[]) => {
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearchQuery = (value: string) => {
    setSearchQuery(value)
  }

  const filteredProducts = products.filter(
    (product) =>
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.category.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return {handleSearchQuery, filteredProducts, searchQuery}
};

export default useSearchProduct;
