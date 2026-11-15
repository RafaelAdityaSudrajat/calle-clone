import { cn } from "@/shared/lib/cn";

export const Skeleton = ({ className }: { className?: string }) => (
  <div
    aria-hidden="true"
    className={cn("animate-pulse rounded-md bg-gray-200", className)}
  />
);
