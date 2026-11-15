import { useCreateCategoryForm } from "@/features/category/category-create";
import { Button, Input } from "@/shared/ui";

export const CategoryCreateSection = () => {
  const {
    form: {
      register,
      formState: { errors },
    },
    onSubmit,
    isPending,
  } = useCreateCategoryForm({});

  return (
    <form className="max-w-full mb-10" noValidate onSubmit={onSubmit}>
      <div className="grid grid-cols-1 mb-3 md:grid-cols-1 gap-x-8">
        <div>
          <Input
            label="Nama Category"
            placeholder="Add Category"
            autoComplete="off"
            autoFocus
            error={errors.name?.message}
            {...register("name")}
          />
        </div>
      </div>

      <div className="w-full mb-3">
        <Button variant="primary" isLoading={isPending} type="submit">
          Add Category
        </Button>
      </div>
    </form>
  );
};
