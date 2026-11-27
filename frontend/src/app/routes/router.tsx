import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Home from "@/pages/home/Home";
import Comunity from "@/pages/comunity/Comunity";
import Archives from "@/pages/archives/Archives";
import About from "@/pages/about/About";
import Products from "@/pages/products/Products";
import Test from "@/pages/test/Test";
import AccountPage from "@/pages/account/AccountPage";
import { AuthModalProvider } from "@/features/auth/ui/AuthModalContext";
import DashboardHome from "@/pages/dashboard/pages/home-page/DashboardHome";
import Checkout from "@/pages/checkout/Checkout";
import DashboardAddProduct from "@/pages/dashboard/pages/add-product-page/DashboardAddProduct";
import ProtectedRoute from "./ProtectedRoute";
import ProductDetailPage from "@/pages/productDetail/ProductDetailPage";
import VerifyEmailPage from "@/pages/verify-email/VerifyEmail";
import ResetPassword from "@/pages/reset-password/ResetPassword";
import AdminAddCategory from "@/pages/dashboard/add-category-page/AdminCategoriesPage";
import { AdminProductsPage } from "@/pages/admin-products";
import { AdminProductDetailPage } from "@/pages/admin-product-detail";
import { AdminProductCreatePage } from "@/pages/admin-product-create";
import { AdminLowStockPage } from "@/pages/admin-low-stock";

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/community" element={<Comunity />} />
        <Route path="/archives" element={<Archives />} />
        <Route
          path="/about"
          element={
            <ProtectedRoute>
              <About />
            </ProtectedRoute>
          }
        />
        <Route path="/products" element={<Products />} />
        <Route path="/products/:id" element={<ProductDetailPage />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/dashboard" element={<DashboardHome />} />
        {/* <Route path="/dashboard/product" element={<DashboardAddProduct />} /> */}
        <Route path="/dashboard/category" element={<AdminAddCategory />} />
        <Route path="/admin/products" element={<AdminProductsPage />} />
        <Route
          path="/admin/products/create"
          element={<AdminProductCreatePage />}
        />
        <Route
          path="/admin/products/:id"
          element={<AdminProductDetailPage />}
        />{" "}
        <Route
          path="/admin/products/low-stock"
          element={<AdminLowStockPage />}
        />
        <Route
          path="/account"
          element={
            <AuthModalProvider>
              <AccountPage />
            </AuthModalProvider>
          }
        />
        <Route path="/test" element={<Test />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        {/* fallback jika route tidak ditemukan */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
