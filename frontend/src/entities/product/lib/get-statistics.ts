import type { Product } from "../model/types";

export const getProductStatistics = (products: Product[]) => ({
  total: products.length,
  lowStock: products.filter((product) => product.stock < 10).length,
  categories: new Set(products.map((product) => product.category)).size,
});

