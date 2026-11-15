import type { Category } from "@/entities/category";
import { Button } from "@/shared/ui";

type CategoryTableProps = {
  data: Category[];
  isFetching: boolean;
  deletingId: string | null;
  isDeletePending: boolean;
  onEdit: (category: Category) => void;
  onDelete: (id: string, name: string) => void;
};

export const CategoryTable = ({
  data,
  isFetching,
  deletingId,
  isDeletePending,
  onEdit,
  onDelete,
}: CategoryTableProps) => {
  return (
    <>
      {isFetching && (
        <span className="text-xs text-gray-400" aria-live="polite">
          Memperbarui…
        </span>
      )}

      <table className="w-full border-collapse table-fixed">
        <thead className="border border-black">
          <tr className="h-10 font-light">
            <th className="w-1/3 border border-black">Category Name</th>
            <th className="w-1/3 border border-black">Update</th>
            <th className="w-1/3 border border-black">Delete</th>
          </tr>
        </thead>

        <tbody>
          {data.map((category) => (
            <tr key={category.id} className="h-10 text-center">
              <td className="border border-black">{category.name}</td>

              <td className="border border-black">
                <div className="flex items-center justify-center w-full h-full">
                  <Button
                    variant="primary"
                    type="button"
                    onClick={() => onEdit(category)}
                  >
                    Update
                  </Button>
                </div>
              </td>

              <td className="border border-black">
                <div className="flex items-center justify-center w-full h-full">
                  <Button
                    variant="primary"
                    type="button"
                    isLoading={deletingId === category.id}
                    disabled={isDeletePending}
                    onClick={() => onDelete(category.id, category.name)}
                  >
                    Delete
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
};
