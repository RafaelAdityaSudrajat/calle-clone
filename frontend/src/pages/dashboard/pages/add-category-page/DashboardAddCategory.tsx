import DashboardLayout from "@/app/layout/DashboardLayout";
import {
  useCreateCategory,
  useDeleteCategoryById,
  useGetCategory,
  useUpdateCategoryById,
} from "@/entities/category/hooks/useCategory";
import {
  createCategorySchema,
  updateCategorySchema,
  type CreateCategoryFormValues,
  type UpdateCategoryFormValues,
} from "@/entities/category/model/category.schema";
import BackDrop from "@/shared/ui/BackDrop";
import InputField from "@/shared/ui/InputField";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { IoMdClose } from "react-icons/io";

const DashboardAddCategory = () => {
  const [backdropTrigger, setBackdropTrigger] = useState<boolean>(false);

  const {
    mutateAsync: createCategory,
    isPending: isCreating,
    isError: isCreateError,
    error: createError,
  } = useCreateCategory();

  const {
    mutateAsync: deleteCategory,
    isPending: isDeleting,
    isError: isDeleteError,
    error: deleteError,
  } = useDeleteCategoryById();

  const {
    mutateAsync: updateCategory,
    // isPending: isUpdating,
    // isError: isUpdatingError,
    // error: updateError,
  } = useUpdateCategoryById();

  const { data: category } = useGetCategory();

  const {
    register: inputCreateCateory,
    handleSubmit: handleInputCreateCategory,
    formState: { errors: errorsCreateCategory },
  } = useForm<CreateCategoryFormValues>({
    resolver: zodResolver(createCategorySchema),
    defaultValues: {
      name: "",
    },
  });

  const {
    register: inputUpdateCateory,
    setValue,
    watch,
    reset,
    handleSubmit: handleInputUpdateCategory,
    formState: { errors: errorsUpdateCategory },
  } = useForm<UpdateCategoryFormValues>({
    resolver: zodResolver(updateCategorySchema),
    defaultValues: {
      name: "",
      id: "",
    },
  });

  const handleOpenBackdropTrigger = (id: string) => {
    setValue("id", id);
    const idData = watch("id");

    console.log(idData);

    setBackdropTrigger((prev) => !prev);
  };

  const handleCloseBackdropTrigger = () => {
    setValue("id", "");

    const idData = watch("id");

    console.log(idData);
    setBackdropTrigger((prev) => !prev);
    reset();
  };

  const handleDeleteCategory = async (id: string) => {
    console.log(id);
    try {
      const datas = await deleteCategory(id);
      console.log(datas);
    } catch (error) {
      if (error instanceof Error) {
        console.log(error.message);
      }
    }
  };

  const handleUpdateCategory = async (payload: UpdateCategoryFormValues) => {
    console.log(payload);
    console.log(payload.name);
    try {
      await updateCategory(payload);

      reset();
    } catch (error) {
      if (error instanceof Error) {
        console.log(error.message);
      }
    }
  };

  const onSubmit = async (data: CreateCategoryFormValues) => {
    console.log(data);
    try {
      const datas = await createCategory(data);

      console.log(datas);
    } catch (error) {
      if (error instanceof Error) {
        console.log(error.message);
      }
    }
  };

  return (
    <DashboardLayout>
      <h1 className="mb-6 text-xl tracking-tight font-extralight text-dashboardTextPrimary">
        Add Category
      </h1>

      <form
        className="max-w-full mb-10"
        onSubmit={handleInputCreateCategory(onSubmit)}
      >
        <div className="grid grid-cols-1 mb-3 md:grid-cols-1 gap-x-8">
          <div>
            <InputField
              label="Category Name"
              placeholder="Enter category name"
              {...inputCreateCateory("name")}
            />{" "}
            {errorsCreateCategory.name && (
              <p className="mb-4 -mt-4 text-xs text-red-500">
                {errorsCreateCategory.name.message}
              </p>
            )}{" "}
            {errorsUpdateCategory.name && (
              <p className="mb-4 -mt-4 text-xs text-red-500">
                {errorsUpdateCategory.name.message}
              </p>
            )}
          </div>
        </div>

        {isCreateError && (
          <div className="p-3 mb-4 text-sm text-red-600 bg-red-100 rounded-lg">
            {(createError as Error)?.message || "Failed to add product"}
          </div>
        )}
        {isDeleteError && (
          <div className="p-3 mb-4 text-sm text-red-600 bg-red-100 rounded-lg">
            {(deleteError as Error)?.message || "Failed delete product"}
          </div>
        )}

        <div className="w-full mb-3">
          <button
            type="submit"
            disabled={isCreating}
            className="bg-dashboardPrimary hover:bg-dashboardPrimary text-white px-8 py-3 rounded-lg text-[15px] font-light transition-all shadow-sm active:scale-95"
          >
            {isCreating ? "Adding..." : "Add Product"}
          </button>
        </div>
      </form>

      <table className="w-full border-collapse table-fixed">
        <thead className="border border-black">
          <tr className="h-10 font-light">
            <th className="w-1/3 border border-black">Category Name</th>
            <th className="w-1/3 border border-black">Update</th>
            <th className="w-1/3 border border-black">Delete</th>
          </tr>
        </thead>
        <tbody>
          {category?.data.map((categoryData) => (
            <tr key={categoryData.id} className="h-10 text-center">
              <td className="border border-black">{categoryData.name}</td>
              <td className="border border-black">
                <div className="flex items-center justify-center w-full h-full ">
                  <button
                    className="px-6 text-white bg-black rounded-sm"
                    onClick={() => handleOpenBackdropTrigger(categoryData.id)}
                  >
                    Update
                  </button>
                </div>
              </td>
              <td className="border border-black">
                <div className="flex items-center justify-center w-full h-full ">
                  <button
                    className="px-6 text-white bg-black rounded-sm"
                    disabled={isDeleting}
                    onClick={() => handleDeleteCategory(categoryData.id)}
                    type="button"
                  >
                    {isDeleting ? "Deleting..." : "Delete"}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <BackDrop trigger={backdropTrigger} onClose={handleCloseBackdropTrigger}>
        <div
          className={`absolute  p-4 bottom-0 right-1/2 w-[95%] max-w-[30rem] translate-x-1/2 overflow-y-auto rounded-t-3xl border border-zinc-200 bg-white transition-transform duration-300 md:bottom-[50%] md:max-h-[80vh] md:translate-y-[50%] md:rounded-3xl ${
            backdropTrigger ? "translate-y-0" : "translate-y-full"
          }`}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-center justify-end w-full mb-2">
            <IoMdClose
              className="w-6 h-6 cursor-pointer"
              onClick={() => handleCloseBackdropTrigger()}
            />
          </div>

          <form
            className="w-full"
            onSubmit={handleInputUpdateCategory(handleUpdateCategory)}
          >
            <InputField
              placeholder="category new name ....."
              label="masukan category baru"
              {...inputUpdateCateory("name")}
            />
            <div className="flex items-center justify-center">
              <button className="px-3 py-2 text-sm text-white bg-black rounded-xl">
                Update Category
              </button>
            </div>
          </form>
        </div>
      </BackDrop>
    </DashboardLayout>
  );
};

export default DashboardAddCategory;
