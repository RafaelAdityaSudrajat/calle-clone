import React from "react";
import { Controller, useForm } from "react-hook-form";
import { NumericFormat } from "react-number-format";
import {
  addProductSchema,
  type AddProductFormValues,
} from "@/features/products/add-product/model/product.schema";
import InputField from "../../../../shared/ui/InputField";
import CategorySelectField from "./CategorySelectField";
import ProductVariantsField from "./ProductVariantsField";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAddProduct } from "../hooks/use-add-product";

const AddProductForm: React.FC = () => {
  const { mutate, isPending, isError, error } = useAddProduct();

  const {
    register,
    handleSubmit,
    reset,
    control,
    watch,
    formState: { errors },
  } = useForm<AddProductFormValues>({
    resolver: zodResolver(addProductSchema),
    defaultValues: {
      name: "",
      description: "",
      price: 0,
      stock: 0,
      categoryId: "",
      variants: [],
    },
  });

  const onSubmit = (data: AddProductFormValues) => {
    console.log("Submitted:", data);
    // mutate(data);
  };

  const handleClear = () => reset();

  return (
    <div className="w-full p-4 bg-white border shadow-sm border-slate-100 rounded-xl">
      <form onSubmit={handleSubmit(onSubmit)} className="max-w-full">
        {/* Row 1: Product Name & SKU */}
        <div className="grid grid-cols-1 md:grid-cols-1 gap-x-8">
          <div>
            <InputField
              label="Product Name"
              placeholder="Enter product name"
              {...register("name")}
            />
            {errors.name && (
              <p className="mb-4 -mt-4 text-xs text-red-500">
                {errors.name.message}
              </p>
            )}
          </div>
        </div>

        {/* Row 2: Price & Stock */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
          <div>
            <Controller
              name="price"
              control={control}
              render={({ field }) => (
                <NumericFormat
                  customInput={InputField}
                  label="Price"
                  placeholder="0"
                  thousandSeparator="."
                  decimalSeparator=","
                  prefix={'Rp '}
                  allowNegative={false}
                  value={field.value}
                  onValueChange={(values) => {
                    field.onChange(values.floatValue ?? 0);
                    console.log(values)
                  }}
                />
              )}
            />
            {errors.price && (
              <p className="mb-4 -mt-4 text-xs text-red-500">
                {errors.price.message}
              </p>
            )}
          </div>
          <div>
            {/* <InputField
              label="Stock Quantity"
              placeholder="0"
              type="number"
              {...register("stock", { valueAsNumber: true })}
            /> */}
            <Controller
              name="stock"
              control={control}
              render={({ field }) => (
                <NumericFormat
                  customInput={InputField}
                  label="Stock Quantity"
                  placeholder="0"
                  allowNegative={false}
                  value={field.value}
                  onValueChange={(values) => {
                    field.onChange(values.floatValue ?? 0);
                  }}
                />
              )}
            />
            {errors.stock && (
              <p className="mb-4 -mt-4 text-xs text-red-500">
                {errors.stock.message}
              </p>
            )}
          </div>
        </div>

        {/* Category */}
        <CategorySelectField register={register} errors={errors} />

        {/* Product Image */}
        <div className="flex flex-col mb-5">
          <label className="text-[14px] font-semibold text-slate-700">
            Product Image
          </label>
          <div className="mt-1.5 flex items-center border border-slate-200 rounded-lg overflow-hidden">
            <label className="bg-slate-100 px-5 py-3 text-[14px] font-medium text-dashboardTextPrimary border-r border-slate-200 cursor-pointer hover:bg-slate-200 transition-colors">
              Choose File
              <input type="file" className="hidden" />
            </label>
            <span className="px-4 text-[14px] text-slate-400">
              No file chosen
            </span>
          </div>
        </div>

        {/* Description */}
        <div>
          <InputField
            label="Description"
            placeholder="Enter product description"
            isTextArea
            {...register("description")}
          />
          {errors.description && (
            <p className="mb-4 -mt-4 text-xs text-red-500">
              {errors.description.message}
            </p>
          )}
        </div>

        {/* Variants */}
        <ProductVariantsField
          control={control}
          register={register}
          errors={errors}
        />

        {isError && (
          <div className="p-3 mb-4 text-sm text-red-600 bg-red-100 rounded-lg">
            {(error as Error)?.message || "Failed to add product"}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3 mt-6">
          <button
            type="submit"
            disabled={isPending}
            className="bg-dashboardPrimary hover:bg-dashboardPrimary text-white px-8 py-3 rounded-lg text-[15px] font-light transition-all shadow-sm active:scale-95"
          >
            {isPending ? "Adding..." : "Add Product"}
          </button>
          <button
            type="button"
            onClick={handleClear}
            className="bg-dashboardTextPrimary hover:bg-slate-800 text-white px-8 py-3 rounded-lg text-[15px] font-semibold transition-all shadow-sm active:scale-95"
          >
            Clear
          </button>
        </div>
      </form>
    </div>
  );
};

export default AddProductForm;
