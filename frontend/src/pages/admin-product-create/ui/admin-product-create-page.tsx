import { Link, useNavigate } from "react-router-dom"; // v7: dari "react-router"
import { ProductCreateForm } from "@/features/products/product-create";
import { Card } from "@/shared/ui";

export const AdminProductCreatePage = () => {
  const navigate = useNavigate();

  return (
    <main className="max-w-2xl p-6 mx-auto space-y-6">
      <nav aria-label="Breadcrumb">
        <Link to="/admin/products" className="text-sm text-gray-500 hover:text-gray-900">
          ← Daftar produk
        </Link>
      </nav>

      <header>
        <h1 className="text-2xl font-semibold text-gray-900">Tambah produk</h1>
        <p className="mt-1 text-sm text-gray-500">
          Produk dibuat sebagai draft. Varian dan gambar ditambahkan setelahnya, lalu publikasikan.
        </p>
      </header>

      <Card title="Informasi produk">
        <ProductCreateForm
          // Setelah dibuat, lanjut ke halaman detail untuk melengkapi varian dan gambar.
          onSuccess={(product) => navigate(`/admin/products/${product.id}`)}
        />
      </Card>
    </main>
  );
};