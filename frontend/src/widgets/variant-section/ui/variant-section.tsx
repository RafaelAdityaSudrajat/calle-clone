import { useState } from "react";
import type { ProductDetail, Variant } from "@/entities/product";
import { VariantCreateModal } from "@/features/products/variant-create";
import { DeleteVariantDialog } from "@/features/products/variant-delete";
import { VariantEditModal } from "@/features/products/variant-edit";
import { VariantStockEditor } from "@/features/products/variant-stock";
import { formatRupiah } from "@/shared/lib/format-currency";
import { Button, Card, EmptyState } from "@/shared/ui";

type DialogState =
  | { type: "closed" }
  | { type: "create" }
  | { type: "edit"; variant: Variant }
  | { type: "delete"; variant: Variant };

export const VariantSection = ({ product }: { product: ProductDetail }) => {
  const [dialog, setDialog] = useState<DialogState>({ type: "closed" });
  const close = () => setDialog({ type: "closed" });

  // Varian terhapus (soft-delete) tidak ditampilkan.
  const variants = product.variants.filter((v) => v.deleted_at === null);

  return (
    <Card title="Varian" description="Ukuran, warna, harga, dan stok.">
      <div className="space-y-4">
        <div className="flex justify-end">
          <Button onClick={() => setDialog({ type: "create" })}>Tambah varian</Button>
        </div>

        {variants.length === 0 ? (
          <EmptyState
            title="Belum ada varian"
            description="Produk harus punya minimal satu varian aktif sebelum bisa dipublikasikan."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm text-left divide-y divide-gray-200">
              <thead className="text-xs tracking-wide text-gray-500 uppercase">
                <tr>
                  <th scope="col" className="px-3 py-2 font-medium">SKU</th>
                  <th scope="col" className="px-3 py-2 font-medium">Ukuran</th>
                  <th scope="col" className="px-3 py-2 font-medium">Warna</th>
                  <th scope="col" className="px-3 py-2 font-medium text-right">Harga</th>
                  <th scope="col" className="px-3 py-2 font-medium">Stok</th>
                  <th scope="col" className="px-3 py-2 font-medium text-right">
                    <span className="sr-only">Aksi</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {variants.map((variant) => (
                  <tr key={variant.id}>
                    <td className="px-3 py-3 font-mono text-xs text-gray-900">{variant.sku}</td>
                    <td className="px-3 py-3 text-gray-700">{variant.size ?? "—"}</td>
                    <td className="px-3 py-3 text-gray-700">{variant.color ?? "—"}</td>
                    <td className="px-3 py-3 text-right text-gray-900 whitespace-nowrap tabular-nums">
                      {formatRupiah(variant.price)}
                    </td>
                    <td className="px-3 py-3">
                      <VariantStockEditor productId={product.id} variant={variant} />
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="secondary"
                          className="px-3 py-1.5"
                          onClick={() => setDialog({ type: "edit", variant })}
                          aria-label={`Edit varian ${variant.sku}`}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="secondary"
                          className="px-3 py-1.5 text-red-600 hover:bg-red-50"
                          onClick={() => setDialog({ type: "delete", variant })}
                          aria-label={`Hapus varian ${variant.sku}`}
                        >
                          Hapus
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <VariantCreateModal productId={product.id} open={dialog.type === "create"} onClose={close} />
      <VariantEditModal
        productId={product.id}
        variant={dialog.type === "edit" ? dialog.variant : null}
        onClose={close}
      />
      <DeleteVariantDialog
        product={product}
        variant={dialog.type === "delete" ? dialog.variant : null}
        onClose={close}
      />
    </Card>
  );
};