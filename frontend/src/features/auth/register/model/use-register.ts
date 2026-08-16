import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { AxiosError } from "axios";
import { registerSchema } from "./RegisterSchema";
import { authApi } from "@/entities/user/api/auth.api"; 
import type { RegisterInput } from "./RegisterSchema";
import { toast } from "sonner";

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useRegister() {
  const navigate = useNavigate();

  const { mutateAsync, isPending, error } = useMutation({
    mutationFn: (input: RegisterInput) => {
      // Zod parse di sini — transform otomatis buang confirmPassword
      const validatedPayload = registerSchema.parse(input);
      return authApi.register(validatedPayload);
    },

    onSuccess: (response) => {
      toast.success(response.message);
      navigate("/account", {
        state: { message: "Registrasi berhasil! Silakan login." },
      });
    },
    onError: (error) => {
      console.log(error);
    },
  });

  // ── Ekstrak error message dari AxiosError ─────────────────────────────────
  const errorMessage = (() => {
    if (!error) return null;

    if (error instanceof AxiosError) {
      const serverMessage = error.response?.data?.message;

      if (error.response?.status === 409)
        return serverMessage ?? "Email atau username sudah digunakan.";

      if (error.response?.status === 422)
        return serverMessage ?? "Data yang dikirim tidak valid.";

      if (!error.response)
        return "Tidak dapat terhubung ke server. Periksa koneksi kamu.";

      return serverMessage ?? "Terjadi kesalahan. Coba lagi.";
    }

    return "Terjadi kesalahan yang tidak terduga.";
  })();

  return {
    register: mutateAsync,
    isLoading: isPending,
    error: errorMessage,
  };
}
