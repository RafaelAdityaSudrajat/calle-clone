import type { ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom"; // v7: dari "react-router"
import { ProductStatusBadge, useProduct } from "@/entities/product";
import { ProductArchiveButton } from "@/features/products/product-archive/ui/product-archive-button";
import { ProductEditForm } from "@/features/products/product-edit/ui/product-edit-form";
import { ProductStatusPanel } from "@/features/products/product-status/ui/product-status-panel";
import { getErrorMessage, isApiError } from "@/shared/api";
import { formatDate } from "@/shared/lib/format-date";
import { Card, EmptyState, ErrorState, Skeleton } from "@/shared/ui";
import { VariantSection } from "@/widgets/variant-section";
import { ImageSection } from "@/widgets/image-section";

const PageShell = ({ children }: { children: ReactNode }) => (
  <main className="max-w-5xl p-6 mx-auto space-y-6">{children}</main>
);



const DetailSkeleton = () => (
  <div aria-busy="true" aria-label="Memuat produk" className="space-y-6">
    <Skeleton className="w-1/3 h-8" />
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <Skeleton className="w-full h-72" />
        <Skeleton className="w-full h-40" />
      </div>
      <Skeleton className="w-full h-48" />
    </div>
  </div>
);

export const AdminProductDetailPage = () => {
  const { id = "" } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: product, isPending, isError, error, refetch } = useProduct(id);

  if (isPending) {
    return (
      <PageShell>
        <DetailSkeleton />
      </PageShell>
    );
  }

  if (isError) {
    // 400 = id bukan UUID valid, 404 = tidak ada / sudah diarsipkan.
    const notFound = isApiError(error) && (error.status === 404 || error.status === 400);

    return (
      <PageShell>
        <div className="bg-white border border-gray-200 rounded-xl">
          {notFound ? (
            <EmptyState
              title="Produk tidak ditemukan"
              description="Produk mungkin sudah diarsipkan atau tautannya salah."
              action={
                <Link
                  to="/admin/products"
                  className="text-sm font-medium text-indigo-600 hover:underline"
                >
                  Kembali ke daftar produk
                </Link>
              }
            />
          ) : (
            <ErrorState message={getErrorMessage(error)} onRetry={() => void refetch()} />
          )}
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <nav aria-label="Breadcrumb">
        <Link to="/admin/products" className="text-sm text-gray-500 hover:text-gray-900">
          ← Daftar produk
        </Link>
      </nav>

      <header className="min-w-0">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold text-gray-900 truncate">{product.name}</h1>
          <ProductStatusBadge status={product.status} />
        </div>
        <p className="mt-1 text-sm text-gray-500">
          Terakhir diperbarui {formatDate(product.updated_at)}
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Informasi produk">
            {/* key: form ter-reset bila produk yang dibuka berganti */}
            <ProductEditForm key={product.id} product={product} />
          </Card>

          <VariantSection product={product} />

         <ImageSection product={product} />
        </div>

        <aside className="space-y-6">
          <ProductStatusPanel product={product} />

          <Card
            title="Zona berbahaya"
            tone="danger"
            description="Produk yang diarsipkan tidak bisa dipulihkan dari aplikasi."
          >
            <ProductArchiveButton
              productId={product.id}
              productName={product.name}
              onArchived={() => navigate("/admin/products", { replace: true })}
            />
          </Card>
        </aside>
      </div>
    </PageShell>
  );
};