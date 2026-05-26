import LayoutPrimary from "@/widgets/layout/LayoutPrimary";
import { MOCK_PRODUCTS } from "@/entities/product";
import ProductCatalog from "@/widgets/products/catalog/ProductCatalog";
import { useProducts } from "@/entities/product/hooks/use-products";

const Products = () => {
  const { data, isLoading, isError } = useProducts();

  console.log(data)

  return (
    <LayoutPrimary>
      <ProductCatalog products={data} />
    </LayoutPrimary>
  );
};

export default Products;
