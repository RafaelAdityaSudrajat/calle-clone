import { cn } from "@/shared/lib/cn";

export const fieldClassName = (hasError: boolean) =>
  cn(
    "block w-full rounded-lg border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2",
    "disabled:bg-gray-100 disabled:text-gray-500",
    hasError
      ? "border-red-500 focus:ring-red-500/30"
      : "border-gray-300 focus:border-indigo-500 focus:ring-indigo-500/30",
  );