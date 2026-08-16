import { useAuthStore } from "@/entities/user/store/auth.store"
import type { ReactNode } from "react"
import { Navigate } from "react-router-dom"

type ProtectedRouteProps = {
  children: ReactNode
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const {isAuthenticated} = useAuthStore()

  if (!isAuthenticated) {
    return <Navigate to="/account" replace />
  }

  return children
}
