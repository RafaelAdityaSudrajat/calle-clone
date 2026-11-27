import { useState } from "react";
import type { ProductDetail, ProductImage } from "@/entities/product";
import { DeleteImageDialog } from "@/features/products/image-delete";
import { SetPrimaryButton } from "@/features/products/image-set-primary";
import { ImageUploader } from "@/features/products/image-upload";
import { Button, Card } from "@/shared/ui";

export const ImageSection = ({ product }: { product: ProductDetail }) => {
  const [toDelete, setToDelete] = useState<ProductImage | null>(null);

  return (
    <Card title="Gambar" description="Gambar utama tampil di daftar produk.">
      <div className="space-y-5">
        <ImageUploader productId={product.id} />

        {product.images.length === 0 ? (
          <p className="text-sm text-center text-gray-500">
            Belum ada gambar. Gambar pertama yang diunggah otomatis menjadi gambar utama.
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {/* Backend sudah mengurutkan: gambar utama di depan. */}
            {product.images.map((image, index) => (
              <li
                key={image.id}
                className={`overflow-hidden rounded-lg border bg-white ${
                  image.is_primary ? "border-indigo-500 ring-1 ring-indigo-500" : "border-gray-200"
                }`}
              >
                <div className="relative bg-gray-100 aspect-square">
                  <img
                    src={image.url}
                    alt={`Gambar ${index + 1} dari ${product.name}`}
                    loading="lazy"
                    className="object-cover size-full"
                  />
                  {image.is_primary && (
                    <span className="absolute left-2 top-2 rounded-full bg-indigo-600 px-2 py-0.5 text-xs font-medium text-white">
                      Utama
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between gap-2 p-2">
                  {image.is_primary ? (
                    <span className="text-xs text-gray-500">Gambar utama</span>
                  ) : (
                    <SetPrimaryButton productId={product.id} imageId={image.id} />
                  )}
                  <Button
                    variant="secondary"
                    className="px-3 py-1.5 text-red-600 hover:bg-red-50"
                    onClick={() => setToDelete(image)}
                    aria-label={`Hapus gambar ${index + 1}`}
                  >
                    Hapus
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <DeleteImageDialog product={product} image={toDelete} onClose={() => setToDelete(null)} />
    </Card>
  );
};