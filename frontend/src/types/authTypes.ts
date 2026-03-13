export interface User {
  id: string
  name: string
  email: string
}

export interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean

  login: (token: string, user: User) => void
  logout: () => void
  setUser: (user: User) => void
}
