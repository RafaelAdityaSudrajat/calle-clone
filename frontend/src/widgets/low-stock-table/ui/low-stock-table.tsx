import { useMemo, useState } from "react";
import { Link } from "react-router-dom"; // v7: dari "react-router"
import { useLowStockVariants } from "@/entities/product";
import { VariantStockEditor } from "@/features/products/variant-stock";
import { getErrorMessage } from "@/shared/api";
import { Button, EmptyState, ErrorState, Skeleton } from "@/shared/ui";

const SkeletonRows = () => (
  <div className="divide-y divide-gray-100" aria-busy="true" aria-label="Memuat daftar stok">
    {Array.from({ length: 5 }, (_, i) => (
      <div key={i} className="flex items-center gap-4 px-4 py-4">
        <Skeleton className="w-1/3 h-4" />
        <Skeleton className="w-1/6 h-4" />
        <Skeleton className="w-20 h-4 ml-auto" />
      </div>
    ))}
  </div>
);

export const LowStockTable = () => {
  const { data, isPending, isError, error, refetch, isFetching } = useLowStockVariants();
  const [search, setSearch] = useState("");

  // Backend tidak memakai paginasi untuk daftar ini, jadi pencarian dilakukan di klien.
  const filtered = useMemo(() => {
    if (!data) return [];
    const keyword = search.trim().toLowerCase();
    if (!keyword) return data;
    return data.filter(
      (item) =>
        item.product_name.toLowerCase().includes(keyword) ||
        item.sku.toLowerCase().includes(keyword),
    );
  }, [data, search]);

  const outOfStock = data?.filter((item) => item.stock === 0).length ?? 0;

  const renderContent = () => {
    if (isPending) return <SkeletonRows />;

    if (isError) {
      return <ErrorState message={getErrorMessage(error)} onRetry={() => void refetch()} />;
    }

    if (data.length === 0) {
      return (
        <EmptyState
          title="Semua stok aman"
          description="Tidak ada varian dengan stok menipis saat ini."
        />
      );
    }

    if (filtered.length === 0) {
      return (
        <EmptyState
          title="Tidak ada hasil"
          description={`Tidak ada varian yang cocok dengan "${search.trim()}".`}
        />
      );
    }

    return (
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm text-left divide-y divide-gray-200">
          <thead className="text-xs tracking-wide text-gray-500 uppercase bg-gray-50">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">Produk</th>
              <th scope="col" className="px-4 py-3 font-medium">SKU</th>
              <th scope="col" className="px-4 py-3 font-medium">Ukuran</th>
              <th scope="col" className="px-4 py-3 font-medium">Warna</th>
              <th scope="col" className="px-4 py-3 font-medium">Stok</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map((item) => (
              <tr key={item.variant_id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <Link
                    to={`/admin/products/${item.product_id}`}
                    className="font-medium text-gray-900 hover:text-indigo-600 hover:underline"
                  >
                    {item.product_name}
                  </Link>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-gray-600">{item.sku}</td>
                <td className="px-4 py-3 text-gray-700">{item.size ?? "—"}</td>
                <td className="px-4 py-3 text-gray-700">{item.color ?? "—"}</td>
                <td className="px-4 py-3">
                  <VariantStockEditor
                    productId={item.product_id}
                    // Semua item di sini lolos filter stok menipis, jadi low_stock pasti true.
                    variant={{ id: item.variant_id, sku: item.sku, stock: item.stock, low_stock: true }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <section className="overflow-hidden bg-white border border-gray-200 shadow-sm rounded-xl">
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-gray-200">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari produk atau SKU…"
          aria-label="Cari varian"
          className="w-full max-w-xs px-3 py-2 text-sm border border-gray-300 rounded-lg focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
        />

        <div className="flex items-center gap-3">
          {data && data.length > 0 && (
            <p className="text-sm text-gray-500" aria-live="polite">
              {data.length} varian menipis
              {outOfStock > 0 && <span className="text-red-600">, {outOfStock} habis</span>}
            </p>
          )}
          <Button
            variant="secondary"
            className="px-3 py-1.5"
            isLoading={isFetching && !isPending}
            onClick={() => void refetch()}
          >
            Muat ulang
          </Button>
        </div>
      </div>

      {renderContent()}
    </section>
  );
};