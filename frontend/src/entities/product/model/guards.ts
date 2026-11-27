import type { ProductDetail } from "./product.schema";

// BR-27: menghapus varian aktif terakhir pada produk ACTIVE → produk jadi INACTIVE.
export const willDeactivateOnVariantDelete = (product: ProductDetail, variantId: string) => {
  const active = product.variants.filter((v) => v.deleted_at === null);
  return product.status === "ACTIVE" && active.length === 1 && active[0]?.id === variantId;
};

// BR-20: menghapus gambar terakhir pada produk ACTIVE → produk jadi INACTIVE.
export const willDeactivateOnImageDelete = (product: ProductDetail, imageId: string) =>
  product.status === "ACTIVE" && product.images.length === 1 && product.images[0]?.id === imageId;