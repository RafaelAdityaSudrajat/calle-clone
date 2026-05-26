import AdminLayout from "../../../../widgets/dashboard/AdminLayout"
import AddProductForm from "../../../../features/products/add-product/ui/AddProductForm"
import HeaderAdminProduct from "./HeaderAdminProduct"

const AdminProduct = () => {
  return (
    <AdminLayout>
      <HeaderAdminProduct />
      <AddProductForm />
    </AdminLayout>
  )
}

export default AdminProduct
