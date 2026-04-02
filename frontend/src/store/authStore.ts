import { create } from "zustand"
import { devtools } from "zustand/middleware"
import type { AuthState, User } from "../types/authTypes"
import { storage } from "../utils/storage"

export const useAuthStore = create<AuthState>()(
  devtools(
    (set) => ({
      user: null,
      token: storage.getToken(),
      isAuthenticated: !!storage.getToken(),

      login: (token: string, user: User) => {
        storage.setToken(token)

        set(
          {
            token,
            user,
            isAuthenticated: true,
          },
          false,
          "auth/login"
        )
      },

      logout: () => {
        storage.removeToken()

        set(
          {
            token: null,
            user: null,
            isAuthenticated: false,
          },
          false,
          "auth/logout"
        )
      },

      setUser: (user: User) => {
        set({ user }, false, "auth/setUser")
      },
    }),
    {
      name: "auth-store",
    }
  )
)