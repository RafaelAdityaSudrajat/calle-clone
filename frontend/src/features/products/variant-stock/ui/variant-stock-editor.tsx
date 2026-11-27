import { useState } from "react";
import type { Variant } from "@/entities/product";
import { Button } from "@/shared/ui";
import { useUpdateStockForm } from "../model/use-update-stock-form";

type StockEditable = Pick<Variant, "id" | "sku" | "stock" | "low_stock">;

interface Props {
  productId: string;
  variant: StockEditable;
}
const StockForm = ({ productId, variant, onDone }: Props & { onDone: () => void }) => {
  const { form, onSubmit, isPending, isDirty } = useUpdateStockForm({
    productId,
    variant,
    onSuccess: onDone,
  });
  const {
    register,
    formState: { errors },
  } = form;

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="flex items-start gap-2"
      onKeyDown={(e) => {
        if (e.key === "Escape") onDone();
      }}
    >
      <div>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          step={1}
          autoFocus
          aria-label={`Stok ${variant.sku}`}
          aria-invalid={Boolean(errors.stock)}
          className="w-24 rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
          {...register("stock", { valueAsNumber: true })}
        />
        {errors.stock && (
          <p role="alert" className="mt-1 text-xs text-red-600">
            {errors.stock.message}
          </p>
        )}
      </div>
      <Button type="submit" className="px-3 py-1.5" isLoading={isPending} disabled={!isDirty}>
        Simpan
      </Button>
      <Button variant="secondary" className="px-3 py-1.5" onClick={onDone} disabled={isPending}>
        Batal
      </Button>
    </form>
  );
};

export const VariantStockEditor = ({ productId, variant }: Props) => {
  const [editing, setEditing] = useState(false);

  // Form di-mount hanya saat mengedit: nilai awalnya selalu stok terbaru.
  if (editing) {
    return <StockForm productId={productId} variant={variant} onDone={() => setEditing(false)} />;
  }

  return (
    <div className="flex items-center gap-2">
      <span className="tabular-nums">{variant.stock}</span>
      {variant.stock === 0 ? (
        <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/20">
          Habis
        </span>
      ) : (
        variant.low_stock && (
          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 ring-1 ring-inset ring-amber-600/20">
            Menipis
          </span>
        )
      )}
      <button
        type="button"
        onClick={() => setEditing(true)}
        aria-label={`Ubah stok ${variant.sku}`}
        className="text-xs font-medium text-indigo-600 hover:underline"
      >
        Ubah
      </button>
    </div>
  );
};