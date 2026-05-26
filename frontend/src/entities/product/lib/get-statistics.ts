import type { ProductResponse } from "../model/product.types";

export const getProductStatistics = (products: ProductResponse[]) => ({
  total: products.length,
  lowStock: products.filter((product) => product.stock < 10).length,
  categories: new Set(products.map((product) => product.category)).size,
});

