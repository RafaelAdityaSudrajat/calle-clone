export type UserRole = "BUYER" | "ADMIN";
export type AccountStatus = "UNVERIFIED" | "ACTIVE" | "SUSPENDED";

export interface User {
  id: string;
  email: string;
  role: UserRole;
  status: AccountStatus;
  createdAt: string;
}

export interface AuthResponse {
  status: string;
  message: string;
  data: User;
}

export interface AuthState {
  isAuthenticated: boolean;
  setUser: () => void;
  clearUser: () => void;
}
