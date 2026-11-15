import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { AxiosError } from "axios";
import { loginSchema } from "./LoginScema";
import type { LoginInput } from "./LoginScema";
import { useAuthStore } from "@/entities/user/store/auth.store";
import { loginApi } from "../api/login.api";
import { toast } from "sonner";

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useLogin() {
  const navigate = useNavigate();
  const { setUser } = useAuthStore();

  const { mutateAsync, isPending, error } = useMutation({
    mutationFn: (input: LoginInput) => {
      const validatedPayload = loginSchema.parse(input);
      return loginApi(validatedPayload);
    },

    onSuccess: (response) => {
      toast.success(response.message);
      setUser();

      navigate("/");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // ── Ekstrak error message dari AxiosError ─────────────────────────────────
  const errorMessage = (() => {
    if (!error) return null;

    if (error instanceof AxiosError) {
      const serverMessage = error.response?.data?.message;

      if (error.response?.status === 401) return serverMessage;

      if (error.response?.status === 400)
        return serverMessage ?? "Validation failed";

      // 429 = terlalu banyak percobaan login (rate limiting)
      if (error.response?.status === 409)
        return (
          serverMessage ??
          "Terlalu banyak percobaan login. Silakan coba lagi nanti."
        );

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
