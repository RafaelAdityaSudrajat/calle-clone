import LayoutPrimary from "@/widgets/layout/LayoutPrimary";
import { useParams } from "react-router-dom";
import MOCK_PRODUCTS from "@/shared/mocks/mockDataProducts";
import ProductGallery from "./ProductGallery";
import ProductInfo from "./ProductInfo";

const ProductDetail = () => {
  const { id } = useParams();
  const product = MOCK_PRODUCTS.find((item) => item.id === id);

  if (!product) {
    return (
      <LayoutPrimary>
        <div className="px-padding_primary py-10">
          <p className="text-lg font-medium">Product tidak ditemukan.</p>
        </div>
      </LayoutPrimary>
    );
  }

  return (
    <LayoutPrimary>
      <div className="w-full py-6 mx-auto px-padding_primary">
        <div className="grid w-full grid-cols-1 gap-6 lg:grid-cols-2">
          {/* LEFT - PRODUCT IMAGE */}
          <ProductGallery />

          {/* RIGHT - PRODUCT INFO */}
          <ProductInfo product={product} />
        </div>
      </div>
    </LayoutPrimary>
  );
};

export default ProductDetail;
