import type { UseFormReturn } from "react-hook-form";
import { Input } from "@/shared/ui";
import type { VariantFormValues } from "../model/variant-form.schema";

export const VariantFormFields = ({ form }: { form: UseFormReturn<VariantFormValues> }) => {
  const {
    register,
    formState: { errors },
  } = form;

  return (
    <div className="space-y-4">
      <Input label="SKU" autoComplete="off" autoFocus error={errors.sku?.message} {...register("sku")} />

      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Ukuran"
          placeholder="Contoh: M"
          autoComplete="off"
          error={errors.size?.message}
          {...register("size")}
        />
        <Input
          label="Warna"
          placeholder="Contoh: Hitam"
          autoComplete="off"
          error={errors.color?.message}
          {...register("color")}
        />
      </div>
      <p className="-mt-2 text-xs text-gray-500">Isi minimal salah satu: ukuran atau warna.</p>

      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Harga (Rp)"
          type="number"
          inputMode="decimal"
          min={0}
          step="any"
          error={errors.price?.message}
          {...register("price", { valueAsNumber: true })}
        />
        <Input
          label="Stok"
          type="number"
          inputMode="numeric"
          min={0}
          step={1}
          error={errors.stock?.message}
          {...register("stock", { valueAsNumber: true })}
        />
      </div>

      {errors.root?.server && (
        <p role="alert" className="px-3 py-2 text-sm text-red-700 rounded-lg bg-red-50">
          {errors.root.server.message}
        </p>
      )}
    </div>
  );
};