import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Home from "@/pages/home/Home";
import Comunity from "@/pages/comunity/Comunity";
import Archives from "@/pages/archives/Archives";
import About from "@/pages/about/About";
import Products from "@/pages/products/Products";
import Test from "@/pages/test/Test";
import ProductDetails from "@/pages/productDetail/ProductDetail";
import Dashboard from "@/pages/dashboard/Dashboard";
import Account from "@/pages/account/Account";

import { AuthModalProvider } from "@/features/auth/AuthModalContext";
import ProtectedRoute from "./ProtectedRoute";

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route
          path="/community"
          element={
            <ProtectedRoute>
              <Comunity />
            </ProtectedRoute>
          }
        />
        <Route path="/archives" element={<Archives />} />
        <Route path="/about" element={<About />} />
        <Route path="/products" element={<Products />} />
        <Route path="/products/:id" element={<ProductDetails />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route
          path="/account"
          element={
            <AuthModalProvider>
              <Account />
            </AuthModalProvider>
          }
        />
        <Route path="/test" element={<Test />} />

        {/* fallback jika route tidak ditemukan */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
