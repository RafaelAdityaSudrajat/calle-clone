import LayoutPrimary from "@/widgets/layout/LayoutPrimary";
import { MOCK_PRODUCTS } from "@/entities/product";
import ProductCatalog from "@/widgets/products/catalog/ProductCatalog";

const Products = () => {
  return (
    <LayoutPrimary>
      <ProductCatalog products={MOCK_PRODUCTS} />
    </LayoutPrimary>
  );
};

export default Products;
