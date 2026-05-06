import React from "react";
import { useQuery } from "@tanstack/react-query";
import { categoryApi } from "@/entities/category";
import type { UseFormRegister, FieldErrors } from "react-hook-form";
import type { AddProductFormValues } from "../model/product.schema";
import InputField from "@/shared/ui/InputField";

interface Props {
  register: UseFormRegister<AddProductFormValues>;
  errors: FieldErrors<AddProductFormValues>;
}

const CategorySelectField: React.FC<Props> = ({ register, errors }) => {
  const {
    data: categoriesRes,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["categories"],
    queryFn: categoryApi.getAll,
  });

  return (
    <div>
      <InputField
        label="Category"
        placeholder="Select category"
        isSelect
        {...register("categoryId")}
      >
        {isLoading && <option disabled>Loading...</option>}
        {isError && <option disabled>Gagal load kategori</option>}
        {categoriesRes?.data.map((cat) => (
          <option key={cat.id} value={cat.id}>
            {cat.name}
          </option>
        ))}
      </InputField>
      {errors.categoryId && (
        <p className="mb-4 -mt-4 text-xs text-red-500">
          {errors.categoryId.message}
        </p>
      )}
    </div>
  );
};

export default CategorySelectField;
