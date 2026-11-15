import { Skeleton } from "@/shared/ui";

export const CategoryListSkeleton = () => (
  <div
    className="divide-y divide-gray-100"
    aria-busy="true"
    aria-label="Memuat kategori"
  >
    {Array.from({ length: 5 }, (_, i) => (
      <div key={i} className="flex items-center gap-4 px-4 py-4">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-4 w-1/4" />
        <Skeleton className="ml-auto h-4 w-24" />
      </div>
    ))}
  </div>
);
