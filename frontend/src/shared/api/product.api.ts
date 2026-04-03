// api/product.api.ts

export const fetchProducts = async (): Promise<any> => {
  const res = await fetch("https://dummyjson.com/products");

  if (!res.ok) {
    throw new Error("Failed to fetch products");
  }

  const json = await res.json();
  return json.data; // normalize langsung di sini
};
