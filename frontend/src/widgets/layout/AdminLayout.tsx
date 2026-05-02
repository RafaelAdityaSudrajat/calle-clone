// src/layouts/DashboardLayout.tsx
import type { ReactNode } from "react";
import Sidebar from "@/widgets/dashboard/SideBar";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar />

      <main className="flex-1">
        {children}
      </main>
    </div>
  );
}
