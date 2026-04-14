import { useEffect, useState } from "react";
import type { Product } from "@/entities/product";
import type { ModalMode } from "@/shared/types/typeModalMode";
import CardDashboardSecondary from "./CardDashboardSecondary";
import Input from "./Input";
import Button from "@/shared/ui/ButtonDashboard";

import { Trash2, X } from "lucide-react";

type ProductModalProps = {
  isOpen: boolean;
  mode: ModalMode;
  product: Product | null;
  onClose: () => void;
  onSave: (product: Partial<Product>) => void;
  onDelete?: () => void;
};

function ProductModal({
  isOpen,
  mode,
  product,
  onClose,
  onSave,
  onDelete,
}: ProductModalProps) {
  const [formData, setFormData] = useState<Partial<Product>>(
    product ?? {
      name: "",
      category: "",
      price: 0,
      stock: 0,
      description: "",
    },
  );

  useEffect(() => {
    setFormData(
      product ?? {
        name: "",
        category: "",
        price: 0,
        stock: 0,
        description: "",
      },
    );
  }, [product, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onSave(formData);
  };

  const isViewMode = mode === "view";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
      <CardDashboardSecondary className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-white">{mode}</h2>
            <button
              onClick={onClose}
              className="text-gray-400 transition-colors hover:text-white"
            >
              <X size={24} />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Product Name"
              placeholder="Enter product name"
              value={formData.name || ""}
              onChange={(value) => setFormData({ ...formData, name: value })}
              required
            />

            <Input
              label="Category"
              placeholder="e.g., Electronics, Accessories"
              value={formData.category || ""}
              onChange={(value) =>
                setFormData({ ...formData, category: value })
              }
              required
            />

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Price (Rp)"
                type="number"
                placeholder="0"
                value={formData.price || ""}
                onChange={(value) =>
                  setFormData({ ...formData, price: Number(value) })
                }
                required
              />

              <Input
                label="Stock"
                type="number"
                placeholder="0"
                value={formData.stock || ""}
                onChange={(value) =>
                  setFormData({ ...formData, stock: Number(value) })
                }
                required
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-gray-300">
                Description
              </label>
              <textarea
                placeholder="Enter product description"
                value={formData.description || ""}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                rows={4}
                className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-white focus:border-transparent transition-all resize-none"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-gray-800">
              <div>
                {mode === "edit" && onDelete && (
                  <Button variant="danger" onClick={onDelete}>
                    <Trash2 size={16} />
                    Delete Product
                  </Button>
                )}
              </div>
              <div className="flex gap-3">
                <Button variant="ghost" onClick={onClose}>
                  Cancel
                </Button>
                {!isViewMode && (
                  <Button type="submit" variant="primary">
                    {mode === "create" ? "Create Product" : "Save Changes"}
                  </Button>
                )}
              </div>
            </div>
          </form>
        </div>
      </CardDashboardSecondary>
    </div>
  );
}

export default ProductModal;
