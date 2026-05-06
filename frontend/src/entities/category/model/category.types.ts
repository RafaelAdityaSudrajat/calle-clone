export interface Category {
  id: string
  name: string
  slug: string
  createdAt: string
  updatedAt: string
}

export interface CategoryResponse {
  status: string
  data: Category
}

export interface CategoriesResponse {
  status: string
  data: Category[]
}