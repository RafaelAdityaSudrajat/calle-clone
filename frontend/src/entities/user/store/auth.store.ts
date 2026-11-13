import { create } from "zustand";
import type { AuthState } from "@/entities/user/model/userTypes";

export const useAuthStore = create<AuthState>()((set) => ({
  isAuthenticated: false,

  setUser: () => set({ isAuthenticated: true }),
  clearUser: () => set({ isAuthenticated: false }),
}));
