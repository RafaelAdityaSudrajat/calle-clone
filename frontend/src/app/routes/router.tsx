import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Home from "@/pages/home/Home";
import Comunity from "@/pages/comunity/Comunity";
import Archives from "@/pages/archives/Archives";
import About from "@/pages/about/About";
import Products from "@/pages/products/Products";
import Test from "@/pages/test/Test";
import Account from "@/pages/account/Account";
import { AuthModalProvider } from "@/features/auth/ui/AuthModalContext";
import DashboardHome from "@/pages/dashboard/pages/home-page/DashboardHome";
import Checkout from "@/pages/checkout/Checkout";
import DashboardAddProduct from "@/pages/dashboard/pages/add-product-page/DashboardAddProduct";
import ProtectedRoute from "./ProtectedRoute";
import DashboardAddCategory from "@/pages/dashboard/pages/add-category-page/DashboardAddCategory";
import ProductDetailPage from "@/pages/productDetail/ProductDetailPage";
import VerifyEmailPage from "@/pages/verify-email/VerifyEmail";
import ResetPassword from "@/pages/reset-password/ResetPassword";

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
        <Route path="/dashboard/product" element={<DashboardAddProduct />} />
        <Route path="/dashboard/category" element={<DashboardAddCategory />} />
        <Route
          path="/account"
          element={
            <AuthModalProvider>
              <Account />
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
