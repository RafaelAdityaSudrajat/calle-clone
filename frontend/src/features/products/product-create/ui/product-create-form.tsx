import { useCategories } from "@/entities/category";
import type { CreateProductResponse } from "@/entities/product";
import { getErrorMessage } from "@/shared/api";
import { Button, Input, Select, Textarea } from "@/shared/ui";
import { useCreateProductForm } from "../model/use-create-product-form";

interface ProductCreateFormProps {
  onSuccess?: (product: CreateProductResponse) => void;
}

export const ProductCreateForm = ({ onSuccess }: ProductCreateFormProps) => {
  const { form, onSubmit, isPending } = useCreateProductForm({ onSuccess });
  const {
    register,
    formState: { errors },
  } = form;

  const categories = useCategories();

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <Input
        label="Nama produk"
        autoComplete="off"
        error={errors.name?.message}
        {...register("name")}
      />

      <Textarea
        label="Deskripsi"
        rows={4}
        error={errors.description?.message}
        {...register("description")}
      />

      <div className="space-y-1.5">
        <Select
          label="Kategori"
          disabled={categories.isPending}
          error={errors.categoryId?.message}
          {...register("categoryId")}
        >
          <option value="">
            {categories.isPending ? "Memuat kategori…" : "Belum dipilih (wajib sebelum publish)"}
          </option>
          {categories.data?.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </Select>
        {categories.isError && (
          <p role="alert" className="text-sm text-red-600">
            {getErrorMessage(categories.error)}{" "}
            <button
              type="button"
              onClick={() => void categories.refetch()}
              className="font-medium underline"
            >
              Coba lagi
            </button>
          </p>
        )}
      </div>

      {/* Error server yang tidak punya field */}
      {errors.root?.server && (
        <p role="alert" className="px-3 py-2 text-sm text-red-700 rounded-lg bg-red-50">
          {errors.root.server.message}
        </p>
      )}

      <div className="flex justify-end">
        <Button type="submit" isLoading={isPending}>
          {isPending ? "Menyimpan…" : "Simpan sebagai draft"}
        </Button>
      </div>
    </form>
  );
};