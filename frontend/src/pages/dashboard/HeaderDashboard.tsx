import { Plus, Package } from "lucide-react";
import Button from "../../components/componentsShared/ButtonDashboard";

interface HeaderDashboardProps {
  handleCreate: () => void;
}

const HeaderDashboard = ({ handleCreate }: HeaderDashboardProps) => {
  return (
    <header className="border-b border-gray-800 bg-gray-950">
      <div className="px-6 py-6 mx-auto max-w-7xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white rounded-lg">
              <Package className="text-black" size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Product Dashboard</h1>
              <p className="text-sm text-gray-400">
                Manage your product inventory
              </p>
            </div>
          </div>
          <Button variant="primary" size="lg" onClick={handleCreate}>
            <Plus size={20} />
            Add Product
          </Button>
        </div>
      </div>
    </header>
  );
};

export default HeaderDashboard;
