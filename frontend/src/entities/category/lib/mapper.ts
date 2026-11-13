import type { CategoryResponse } from "../api/schema";
import type { Category } from "../model/types";

export function mapCategory(dto: CategoryResponse): Category {
  return {
    id: dto.id,
    name: dto.name,
    slug: dto.slug,
    createdAt: new Date(dto.createdAt),
    updatedAt: new Date(dto.updatedAt),
  };
}
