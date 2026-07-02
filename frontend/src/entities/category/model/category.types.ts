export interface Category {
  id: string
  name: string
  slug: string
  createdAt: string
  updatedAt: string
}


export interface CreateCategoryResponse {
  status: string
  message: string
  data: Category


}

export interface CategoryResponse {
  status: string
  data: Category[]
}

export interface DeleteCategoryByIdResponse {
  status: string
  message: string
}

export interface UpdateCategoryResponse {
  status: string
  message: string
}