const TOKEN_KEY = "auth_token"

export const storage = {
  getToken: (): string | null => {
    return localStorage.getItem(TOKEN_KEY)
  },

  setToken: (token: string) => {
    localStorage.setItem(TOKEN_KEY, token)
  },

  removeToken: () => {
    localStorage.removeItem(TOKEN_KEY)
  },
}