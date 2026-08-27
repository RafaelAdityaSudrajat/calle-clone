import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { AxiosError } from "axios";
import { loginSchema } from "./LoginScema";
import type { LoginInput } from "./LoginScema";
import { useAuthStore } from "@/entities/user/store/auth.store";
import { loginApi } from "../api/login.api";

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useLogin() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const setUser = useAuthStore((state) => state.setUser);

  const { mutateAsync, isPending, error } = useMutation({
    mutationFn: (input: LoginInput) => {
      const validatedPayload = loginSchema.parse(input);
      return loginApi(validatedPayload);
    },

    onSuccess: (data) => {
      setUser(data.data);
      queryClient.setQueryData(["auth", "me"], data);

      navigate("/", {
        state: { message: "login berhasil" },
      });
    },
  });

  // ── Ekstrak error message dari AxiosError ─────────────────────────────────
  const errorMessage = (() => {
    if (!error) return null;

    if (error instanceof AxiosError) {
      const serverMessage = error.response?.data?.message;

      if (error.response?.status === 401)
        return serverMessage ?? "Email atau password salah.";

      // 403 = akun dinonaktifkan / banned
      if (error.response?.status === 403)
        return serverMessage ?? "Akun kamu tidak aktif. Hubungi support.";

      // 429 = terlalu banyak percobaan login (rate limiting)
      if (error.response?.status === 429)
        return serverMessage ?? "Terlalu banyak percobaan. Coba lagi nanti.";

      if (!error.response)
        return "Tidak dapat terhubung ke server. Periksa koneksi kamu.";

      return serverMessage ?? "Terjadi kesalahan. Coba lagi.";
    }

    return "Terjadi kesalahan yang tidak terduga.";
  })();

  return {
    login: mutateAsync,
    isLoading: isPending,
    error: errorMessage,
  };
}
