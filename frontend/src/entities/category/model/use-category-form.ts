import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { categoryFormSchema, type CategoryFormValues } from "./category.schema";

export const useCategoryForm = (defaultValues?: Partial<CategoryFormValues>) =>
  useForm<CategoryFormValues>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: { name: "", ...defaultValues },
  });
