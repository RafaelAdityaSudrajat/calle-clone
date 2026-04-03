// src/components/layout/MainLayout.tsx
import type { ReactNode } from "react";
import Header from "./header/Header";
import Footer from "./footer/Footer";

interface MainLayoutProps {
  children: ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      {children}
      <Footer />
    </div>
  );
}
