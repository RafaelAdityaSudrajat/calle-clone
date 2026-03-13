export const getProductStatistics = (products: any) => {
  return {
    total: products.length,
    lowStock: products.filter((product: any) => product.stock < 10).length,
    categories: new Set(products.map((product: any) => product.category)).size,
  };
};
