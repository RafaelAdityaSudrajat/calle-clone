import { Link } from "react-router-dom"; // v7: dari "react-router"
import { LowStockTable } from "@/widgets/low-stock-table";

export const AdminLowStockPage = () => (
  <main className="max-w-5xl p-6 mx-auto space-y-6">
    <nav aria-label="Breadcrumb">
      <Link to="/admin/products" className="text-sm text-gray-500 hover:text-gray-900">
        ← Daftar produk
      </Link>
    </nav>

    <header>
      <h1 className="text-2xl font-semibold text-gray-900">Stok menipis</h1>
      <p className="mt-1 text-sm text-gray-500">
        Varian aktif yang stoknya hampir atau sudah habis, diurutkan dari yang paling kritis.
      </p>
    </header>

    <LowStockTable />
  </main>
);