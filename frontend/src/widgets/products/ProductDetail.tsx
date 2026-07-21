import LayoutPrimary from "@/widgets/layout/LayoutPrimary";
import { useParams } from "react-router-dom";
import { useGetProductDetail } from "@/entities/product/hooks/use-products";
import ProductInfo from "../../features/products/product-detail/ui/ProductInfo";
import ProductGallery from "@/entities/product/ui/ProductGallery";

const ProductDetail = () => {
  const { id } = useParams();
  const { data: product, isLoading, isError } = useGetProductDetail(id ?? "");

  if (isLoading) {
    return (
      <LayoutPrimary>
        <div className="py-10 px-padding_primary">
          <p className="text-lg font-medium">Loading product...</p>
        </div>
      </LayoutPrimary>
    );
  }

  if (isError) {
    return (
      <LayoutPrimary>
        <div className="py-10 px-padding_primary">
          <p className="text-lg font-medium">
            Gagal memuat detail produk. Coba lagi sebentar.
          </p>
        </div>
      </LayoutPrimary>
    );
  }

  if (!product) {
    return (
      <LayoutPrimary>
        <div className="py-10 px-padding_primary">
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
          <ProductGallery product={product} />

          {/* RIGHT - PRODUCT INFO */}
          <ProductInfo product={product} />
        </div>
      </div>
    </LayoutPrimary>
  );
};

export default ProductDetail;
