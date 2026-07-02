import React from "react";
import { Controller, useFieldArray } from "react-hook-form";
import type { Control, UseFormRegister, FieldErrors } from "react-hook-form";
import type { AddProductFormValues } from "../../../../entities/product/model/product.schema";
import InputField from "@/shared/ui/InputField";
import { NumericFormat } from "react-number-format";

interface Props {
  control: Control<AddProductFormValues>;
  register: UseFormRegister<AddProductFormValues>;
  errors: FieldErrors<AddProductFormValues>;
}

const ProductVariantsField: React.FC<Props> = ({
  control,
  register,
  errors,
}) => {
  const { fields, append, remove } = useFieldArray({
    control,
    name: "variants",
  });

  return (
    <div className="mb-5">
      <div className="flex items-center justify-between mb-3">
        <label className="text-[14px] font-light text-dashboardTextPrimary">
          Product Variants
        </label>
        <button
          type="button"
          onClick={() => append({ size: "", color: "", stock: 0 })}
          className="text-[13px] text-dashboardPrimary hover:underline"
        >
          + Add Variant
        </button>
      </div>

      {fields.length === 0 && (
        <p className="text-[13px] text-slate-400 text-center py-4 border border-dashed border-slate-200 rounded-lg">
          No variants added yet
        </p>
      )}

      {fields.map((field, index) => (
        <div
          key={field.id}
          className="grid grid-cols-3 gap-3 p-3 mb-3 border rounded-lg border-slate-100"
        >
          <div>
            <InputField
              label="Size"
              placeholder="Size..."
              type="text"
              {...register(`variants.${index}.size`, {
                setValueAs: (value) => value.toUpperCase(),
              })}
            />

            {errors.variants?.[index]?.size && (
              <p className="mb-2 -mt-4 text-xs text-red-500">
                {errors.variants[index].size?.message}
              </p>
            )}
          </div>
          <div>
            <InputField
              label="Color"
              placeholder="Hitam, Putih..."
              {...register(`variants.${index}.color`)}
            />
            {errors.variants?.[index]?.color && (
              <p className="mb-2 -mt-4 text-xs text-red-500">
                {errors.variants[index].color?.message}
              </p>
            )}
          </div>
          <div className="relative">
            {/* <InputField
              label="Stock"
              placeholder="0"
              type="number"
              {...register(`variants.${index}.stock`, { valueAsNumber: true })}
            /> */}
            <Controller
              name={`variants.${index}.stock`}
              control={control}
              render={({ field }) => (
                <NumericFormat
                  customInput={InputField}
                  label="Stock"
                  placeholder="0"
                  allowNegative={false}
                  value={field.value}
                  onValueChange={(values) => {
                    field.onChange(values.floatValue ?? 0);
                  }}
                />
              )}
            />
            {errors.variants?.[index]?.stock && (
              <p className="mb-2 -mt-4 text-xs text-red-500">
                {errors.variants[index].stock?.message}
              </p>
            )}
            <button
              type="button"
              onClick={() => remove(index)}
              className="absolute top-0 right-0 text-[12px] text-red-400 hover:text-red-600"
            >
              Remove
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default ProductVariantsField;
