
import DashboardLayout from "@/app/layout/DashboardLayout"
import AddProductForm from "../../../../features/products/add-product/ui/AddProductForm"
import HeaderAdminProduct from "../../../../widgets/dashboard/HeaderAdminProduct"

const DashboardAddProduct = () => {
  return (
    <DashboardLayout>
      <HeaderAdminProduct />
      <AddProductForm />
    </DashboardLayout>
  )
}

export default DashboardAddProduct
