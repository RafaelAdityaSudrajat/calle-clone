import type { ReactNode } from "react"
import { Navigate } from "react-router-dom"
import { useAuthHooks } from "../../feature/auth/useAuthHooks"

type ProtectedRouteProps = {
  children: ReactNode
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated } = useAuthHooks()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return children
}
