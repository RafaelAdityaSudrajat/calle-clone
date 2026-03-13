import type { Product } from "../../types/typeProduct";
import { Trash2, Edit2 } from "lucide-react";


type ProductTableProps = {
  products: Product[];
  onEdit: (product: Product) => void;
  onView: (product: Product) => void;
  onDelete: (id: string) => void;
};

function ProductTable({
  products,
  onEdit,
  onView,
  onDelete,
}: ProductTableProps) {
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(price);
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-800">
            <th className="px-6 py-4 text-sm font-semibold tracking-wider text-left text-gray-400 uppercase">
              Product
            </th>
            <th className="px-6 py-4 text-sm font-semibold tracking-wider text-left text-gray-400 uppercase">
              Category
            </th>
            <th className="px-6 py-4 text-sm font-semibold tracking-wider text-left text-gray-400 uppercase">
              Price
            </th>
            <th className="px-6 py-4 text-sm font-semibold tracking-wider text-left text-gray-400 uppercase">
              Stock
            </th>
            <th className="px-6 py-4 text-sm font-semibold tracking-wider text-right text-gray-400 uppercase">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800">
          {products.map((product) => (
            <tr
              key={product.id}
              className="transition-colors cursor-pointer hover:bg-gray-800/50"
              onClick={() => onView(product)}
            >
              <td className="px-6 py-4">
                <div className="font-medium text-white">{product.name}</div>
                <div className="mt-1 text-sm text-gray-400 line-clamp-1">
                  {product.description}
                </div>
              </td>
              <td className="px-6 py-4">
                <span className="inline-flex items-center px-3 py-1 text-xs font-medium text-gray-300 bg-gray-800 border border-gray-700 rounded-full">
                  {product.category}
                </span>
              </td>
              <td className="px-6 py-4 font-medium text-white">
                {formatPrice(product.price)}
              </td>
              <td className="px-6 py-4">
                <span
                  className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                    product.stock > 20
                      ? "bg-green-900/30 text-green-400 border border-green-800"
                      : product.stock > 10
                        ? "bg-yellow-900/30 text-yellow-400 border border-yellow-800"
                        : "bg-red-900/30 text-red-400 border border-red-800"
                  }`}
                >
                  {product.stock} units
                </span>
              </td>
              <td className="px-6 py-4">
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(product);
                    }}
                    className="p-2 text-gray-400 transition-all rounded-lg hover:text-white hover:bg-gray-800"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(product.id);
                    }}
                    className="p-2 text-gray-400 transition-all rounded-lg hover:text-red-400 hover:bg-gray-800"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default ProductTable