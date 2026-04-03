import { useMemo, useState } from "react";
import type { Product } from "@/shared/types/typeProduct";

const useSearchProductByName = (products: Product[]) => {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredProducts = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    if (!normalizedQuery) {
      return products;
    }

    return products.filter((product) =>
      product.name.toLowerCase().includes(normalizedQuery),
    );
  }, [products, searchQuery]);

  return {
    searchQuery,
    filteredProducts,
    handleSearchQuery: setSearchQuery,
  };
};

export default useSearchProductByName;
