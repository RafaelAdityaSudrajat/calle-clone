import { queryOptions, useQuery } from "@tanstack/react-query";
import { categoryKeys } from "../model/category.keys";
import { getCategories, getCategoryById } from "./category.api";

// queryOptions: satu definisi, bisa dipakai di useQuery, prefetch, dan invalidate.
export const categoryQueries = {
  list: () =>
    queryOptions({
      queryKey: categoryKeys.lists(),
      queryFn: ({ signal }) => getCategories(signal),
    }),
  detail: (id: string) =>
    queryOptions({
      queryKey: categoryKeys.detail(id),
      queryFn: ({ signal }) => getCategoryById(id, signal),
      enabled: Boolean(id),
    }),
};

export const useCategories = () => useQuery(categoryQueries.list());
export const useCategory = (id: string) => useQuery(categoryQueries.detail(id));
