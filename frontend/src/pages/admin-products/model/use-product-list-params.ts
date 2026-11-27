import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom"; // v7: dari "react-router"
import { z } from "zod";
import { productStatusSchema, type ProductListParams } from "@/entities/product";

const PAGE_SIZE = 10;

// Nilai URL tidak bisa dipercaya: yang tidak valid jatuh ke default, bukan melempar error.
const urlSchema = z.object({
  page: z.coerce.number().int().min(1).catch(1),
  search: z.string().trim().max(100).catch(""),
  status: productStatusSchema.optional().catch(undefined),
  category: z.uuid().optional().catch(undefined),
  deleted: z.enum(["true", "false"]).catch("false"),
});

const parseParams = (sp: URLSearchParams): ProductListParams => {
  const v = urlSchema.parse(Object.fromEntries(sp));
  return {
    page: v.page,
    limit: PAGE_SIZE,
    search: v.search || undefined,
    status: v.status,
    categoryId: v.category,
    includeDeleted: v.deleted === "true",
  };
};

// Hanya nilai non-default yang ditulis, supaya URL tetap bersih.
const toSearchParams = (p: ProductListParams): URLSearchParams => {
  const sp = new URLSearchParams();
  if (p.page && p.page > 1) sp.set("page", String(p.page));
  if (p.search) sp.set("search", p.search);
  if (p.status) sp.set("status", p.status);
  if (p.categoryId) sp.set("category", p.categoryId);
  if (p.includeDeleted) sp.set("deleted", "true");
  return sp;
};

export const useProductListParams = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const params = useMemo(() => parseParams(searchParams), [searchParams]);

  const update = useCallback(
    (patch: Partial<ProductListParams>, replace: boolean) => {
      setSearchParams(
        (prev) => {
          const next = { ...parseParams(prev), ...patch };
          // Ubah filter → kembali ke halaman 1, kecuali yang diubah memang halamannya.
          if (!("page" in patch)) next.page = 1;
          return toSearchParams(next);
        },
        { replace },
      );
    },
    [setSearchParams],
  );

  // Filter memakai replace (tidak menumpuk history); pindah halaman memakai push.
  const setFilter = useCallback((patch: Partial<ProductListParams>) => update(patch, true), [update]);
  const setPage = useCallback((page: number) => update({ page }, false), [update]);
  const resetFilters = useCallback(() => setSearchParams({}, { replace: true }), [setSearchParams]);

  return { params, setFilter, setPage, resetFilters };
};