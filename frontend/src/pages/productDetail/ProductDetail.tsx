import LayoutPrimary from "@/layout/LayoutPrimary";
import ProductGallery from "./ProductGallery";
import ProductInfo from "./ProductInfo";

const ProductDetail = () => {
  return (
    <LayoutPrimary>
      <div className="w-full py-6 mx-auto px-padding_primary">
        <div className="grid w-full grid-cols-1 gap-6 lg:grid-cols-2">
          {/* LEFT - PRODUCT IMAGE */}
          <ProductGallery />

          {/* RIGHT - PRODUCT INFO */}
          <ProductInfo />
        </div>
      </div>
    </LayoutPrimary>
  );
};

export default ProductDetail;
