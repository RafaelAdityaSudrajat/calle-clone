import { Link } from "react-router-dom"; // v7: dari "react-router"
import {
  HiOutlineArchiveBox,
  HiOutlineArrowPath,
  HiOutlineChevronLeft,
  HiOutlineChevronRight,
  HiOutlineCube,
  HiOutlineExclamationTriangle,
  HiOutlinePencilSquare,
  HiOutlinePhoto,
} from "react-icons/hi2";
import {
  PRODUCT_STATUS_LABELS,
  useProducts,
  type ProductListItem,
  type ProductListParams,
} from "@/entities/product";
import { useArchiveProduct } from "@/features/products/product-archive";
import { getErrorMessage } from "@/shared/api";
import { formatDate } from "@/shared/lib/format-date";

interface ProductTableProps {
  params: ProductListParams;
  onPageChange: (page: number) => void;
}

const getStatusBadgeClass = (status: string) => {
  switch (status.toLowerCase()) {
    case "active":
    case "published":
      return "bg-emerald-50 text-emerald-700 ring-emerald-600/20";
    case "draft":
      return "bg-amber-50 text-amber-700 ring-amber-600/20";
    case "archived":
    case "deleted":
      return "bg-slate-100 text-slate-600 ring-slate-500/20";
    default:
      return "bg-[#F5F6F8] text-slate-700 ring-slate-300/60";
  }
};

export const ProductTable = ({ params, onPageChange }: ProductTableProps) => {
  const { data, isPending, isError, error, refetch, isPlaceholderData } =
    useProducts(params);
  const archive = useArchiveProduct();

  const handleArchive = (product: ProductListItem) => {
    // Placeholder: ganti dengan dialog konfirmasi buatanmu.
    if (
      window.confirm(
        `Arsipkan "${product.name}"? Produk tidak bisa dipulihkan dari aplikasi.`,
      )
    ) {
      archive.mutate(product.id);
    }
  };

  if (isPending) {
    return (
      <div
        role="status"
        className="w-full overflow-hidden bg-white border rounded-xl border-slate-200/80"
      >
        <span className="sr-only">Memuat produk…</span>
        <div className="divide-y divide-slate-100">
          {Array.from({ length: 5 }).map((_, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between gap-4 px-5 py-3.5 animate-pulse"
            >
              <div className="flex items-center gap-3.5 min-w-0 flex-1">
                <div className="w-11 h-11 rounded-lg bg-[#F5F6F8] shrink-0" />
                <div className="space-y-2 w-full max-w-[220px]">
                  <div className="h-3.5 rounded bg-[#F5F6F8] w-4/5" />
                  <div className="h-3 rounded bg-[#F5F6F8] w-1/2" />
                </div>
              </div>
              <div className="hidden sm:block h-5 w-20 rounded-full bg-[#F5F6F8]" />
              <div className="hidden md:block h-3.5 w-16 rounded bg-[#F5F6F8]" />
              <div className="h-8 w-28 rounded-lg bg-[#F5F6F8]" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div
        role="alert"
        className="flex flex-col items-center justify-center w-full px-6 py-12 text-center bg-white border rounded-xl border-slate-200/80"
      >
        <div className="flex items-center justify-center mb-3 w-11 h-11 rounded-xl bg-rose-50 text-rose-600">
          <HiOutlineExclamationTriangle className="w-5 h-5" />
        </div>
        <p className="text-sm font-medium text-slate-900">
          Gagal memuat daftar produk
        </p>
        <p className="max-w-md mt-1 text-xs text-slate-500">
          {getErrorMessage(error)}
        </p>
        <button
          type="button"
          onClick={() => void refetch()}
          className="mt-4 inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-[#F5F6F8] hover:bg-slate-200/70 text-sm font-medium text-slate-800 transition cursor-pointer"
        >
          <HiOutlineArrowPath className="w-4 h-4" />
          <span>Coba lagi</span>
        </button>
      </div>
    );
  }

  const { items, pagination } = data;

  if (items.length === 0) {
    const isOutOfRange = (params.page ?? 1) > 1;

    return (
      <div className="flex flex-col items-center justify-center w-full px-6 text-center bg-white border rounded-xl border-slate-200/80 py-14">
        <div className="w-11 h-11 rounded-xl bg-[#F5F6F8] text-slate-500 flex items-center justify-center mb-3">
          <HiOutlineCube className="w-5 h-5" />
        </div>
        <p className="text-sm font-medium text-slate-900">
          {isOutOfRange
            ? "Halaman ini kosong."
            : "Tidak ada produk yang cocok."}
        </p>
        <p className="max-w-sm mt-1 text-xs text-slate-500">
          {isOutOfRange
            ? "Nomor halaman melebihi total data yang tersedia saat ini."
            : "Coba ubah kata kunci pencarian atau atur ulang filter yang aktif."}
        </p>
        {isOutOfRange && (
          <button
            type="button"
            onClick={() => onPageChange(1)}
            className="mt-4 inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 text-sm font-medium text-white transition cursor-pointer"
          >
            <span>Kembali ke halaman 1</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      aria-busy={isPlaceholderData}
      className="relative w-full overflow-hidden bg-white border rounded-xl border-slate-200/80"
    >
      {/* Subtle Updating Indicator */}
      {isPlaceholderData && (
        <div
          role="status"
          className="absolute top-2.5 right-3 z-10 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900/90 text-[11px] font-medium text-white shadow-xs"
        >
          <HiOutlineArrowPath className="w-3 h-3 animate-spin" />
          <span>Memperbarui…</span>
        </div>
      )}

      {/* Responsive Table Wrapper */}
      <div className="w-full overflow-x-auto">
        <table className="w-full text-sm text-left border-collapse">
          <caption className="sr-only">Daftar produk</caption>
          <thead>
            <tr className="bg-[#F5F6F8]/80 border-b border-slate-200/80 text-xs font-medium text-slate-500">
              <th scope="col" className="py-3 pl-5 pr-3 w-[72px]">
                Gambar
              </th>
              <th scope="col" className="px-3 py-3">
                Nama
              </th>
              <th scope="col" className="px-3 py-3">
                Kategori
              </th>
              <th scope="col" className="px-3 py-3">
                Status
              </th>
              <th scope="col" className="px-3 py-3 text-right">
                Varian
              </th>
              <th scope="col" className="px-3 py-3 text-right">
                Total stok
              </th>
              <th scope="col" className="px-3 py-3">
                Diperbarui
              </th>
              <th scope="col" className="py-3 pl-3 pr-5 text-right">
                Aksi
              </th>
            </tr>
          </thead>

          <tbody
            className={`divide-y divide-slate-100 transition-opacity duration-150 ${
              isPlaceholderData ? "opacity-60" : "opacity-100"
            }`}
          >
            {items.map((product) => {
              const isArchivingThis =
                archive.isPending && archive.variables === product.id;

              return (
                <tr
                  key={product.id}
                  className="group hover:bg-[#F5F6F8]/60 transition-colors"
                >
                  {/* Thumbnail */}
                  <td className="py-3 pl-5 pr-3 whitespace-nowrap">
                    {product.primary_image_url ? (
                      <img
                        src={product.primary_image_url}
                        alt=""
                        width={48}
                        height={48}
                        loading="lazy"
                        className="w-11 h-11 rounded-lg object-cover bg-[#F5F6F8] border border-slate-200/70"
                      />
                    ) : (
                      <div
                        aria-hidden="true"
                        className="w-11 h-11 rounded-lg bg-[#F5F6F8] border border-slate-200/60 flex items-center justify-center text-slate-400"
                      >
                        <HiOutlinePhoto className="w-5 h-5" />
                      </div>
                    )}
                  </td>

                  {/* Product Name */}
                  <td className="py-3 px-3 font-medium text-slate-900 max-w-[260px]">
                    <Link
                      to={`/admin/products/${product.id}`}
                      className="line-clamp-1 hover:underline underline-offset-4 decoration-slate-400"
                    >
                      {product.name}
                    </Link>
                  </td>

                  {/* Category */}
                  <td className="px-3 py-3 whitespace-nowrap text-slate-600">
                    {product.category?.name ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-md bg-[#F5F6F8] text-xs font-medium text-slate-700">
                        {product.category.name}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>

                  {/* Status Badge */}
                  <td className="px-3 py-3 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ring-1 ring-inset ${getStatusBadgeClass(
                        product.status,
                      )}`}
                    >
                      {PRODUCT_STATUS_LABELS[product.status]}
                    </span>
                  </td>

                  {/* Variant Count */}
                  <td className="px-3 py-3 text-right whitespace-nowrap tabular-nums text-slate-700">
                    {product.variant_count}
                  </td>

                  {/* Total Stock */}
                  <td className="px-3 py-3 text-right whitespace-nowrap tabular-nums">
                    <span
                      className={
                        product.total_stock === 0
                          ? "font-medium text-rose-600"
                          : "text-slate-700"
                      }
                    >
                      {product.total_stock}
                    </span>
                  </td>

                  {/* Updated At */}
                  <td className="px-3 py-3 text-xs whitespace-nowrap text-slate-500">
                    {formatDate(product.updated_at)}
                  </td>

                  {/* Row Actions */}
                  <td className="py-3 pl-3 pr-5 text-right whitespace-nowrap">
                    <div className="inline-flex items-center justify-end gap-1.5">
                      <Link
                        to={`/admin/products/${product.id}`}
                        className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg bg-[#F5F6F8] hover:bg-slate-200/70 text-xs font-medium text-slate-700 hover:text-slate-900 transition"
                      >
                        <HiOutlinePencilSquare className="w-3.5 h-3.5" />
                        <span>Kelola</span>
                      </Link>

                      <button
                        type="button"
                        onClick={() => handleArchive(product)}
                        disabled={isArchivingThis}
                        className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-xs font-medium text-slate-500 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-50 disabled:pointer-events-none transition cursor-pointer"
                      >
                        <HiOutlineArchiveBox className="w-3.5 h-3.5" />
                        <span>
                          {isArchivingThis ? "Mengarsipkan…" : "Arsipkan"}
                        </span>
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <nav
        aria-label="Paginasi"
        className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-xs bg-white border-t border-slate-200/80 text-slate-600"
      >
        <span>
          Halaman{" "}
          <strong className="font-semibold text-slate-900">
            {pagination.page}
          </strong>{" "}
          dari{" "}
          <strong className="font-semibold text-slate-900">
            {pagination.total_pages}
          </strong>{" "}
          <span className="text-slate-400">({pagination.total} produk)</span>
        </span>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={isPlaceholderData || pagination.page <= 1}
            onClick={() => onPageChange(pagination.page - 1)}
            className="inline-flex items-center gap-1 h-8 px-3 rounded-lg bg-[#F5F6F8] hover:bg-slate-200/70 font-medium text-slate-700 disabled:opacity-40 disabled:pointer-events-none transition cursor-pointer"
          >
            <HiOutlineChevronLeft className="w-3.5 h-3.5" />
            <span>Sebelumnya</span>
          </button>

          <button
            type="button"
            disabled={
              isPlaceholderData || pagination.page >= pagination.total_pages
            }
            onClick={() => onPageChange(pagination.page + 1)}
            className="inline-flex items-center gap-1 h-8 px-3 rounded-lg bg-[#F5F6F8] hover:bg-slate-200/70 font-medium text-slate-700 disabled:opacity-40 disabled:pointer-events-none transition cursor-pointer"
          >
            <span>Berikutnya</span>
            <HiOutlineChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </nav>
    </div>
  );
};