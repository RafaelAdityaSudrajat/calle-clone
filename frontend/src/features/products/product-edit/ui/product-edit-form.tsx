import { useCategories } from "@/entities/category";
import type { ProductDetail } from "@/entities/product";
import { getErrorMessage } from "@/shared/api";
import { Button, Input, Select, Textarea } from "@/shared/ui";
import { useUpdateProductForm } from "../model/use-update-product-form";

interface ProductEditFormProps {
  product: ProductDetail;
  onSuccess?: () => void;
}

export const ProductEditForm = ({ product, onSuccess }: ProductEditFormProps) => {
  const { form, onSubmit, isPending, isDirty } = useUpdateProductForm({ product, onSuccess });
  const {
    register,
    formState: { errors },
  } = form;

  const categories = useCategories();
  // Selama daftar dimuat, tetap sediakan kategori produk ini agar <select> tidak menipu.
  const options = categories.data ?? (product.category ? [product.category] : []);

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
        <Select label="Kategori" error={errors.categoryId?.message} {...register("categoryId")}>
          {/* Produk ACTIVE wajib punya kategori (BR-24). */}
          <option value="" disabled={product.status === "ACTIVE"}>
            Belum dipilih
          </option>
          {options.map((category) => (
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

      {errors.root?.server && (
        <p role="alert" className="px-3 py-2 text-sm text-red-700 rounded-lg bg-red-50">
          {errors.root.server.message}
        </p>
      )}

      <div className="flex justify-end">
        <Button type="submit" isLoading={isPending} disabled={!isDirty}>
          Simpan perubahan
        </Button>
      </div>
    </form>
  );
};