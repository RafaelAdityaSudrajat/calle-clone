import { useSearchParams } from "react-router-dom";
import {
  resetPasswordSchema,
  type ResetPasswordInput,
} from "../model/ResetPasswordSchema";
import { toast } from "sonner";
import { useMutation } from "@tanstack/react-query";
import { resetPasswordApi } from "../api/resetPasswordApi";

const useResetPassword = () => {
  const [searchParams] = useSearchParams();

  const token = searchParams.get("token");

  const { mutateAsync, isPending } = useMutation({
    mutationFn: (input: ResetPasswordInput) => {
      // Validasi newPassword + confirmPassword
      const validatedPayload = resetPasswordSchema.parse(input);

      console.log(validatedPayload);

      // Token wajib ada
      if (!token) {
        throw new Error("Token reset password tidak ditemukan");
      }

      return resetPasswordApi({
        newPassword: validatedPayload.newPassword,
        token,
      });
    },

    onSuccess: (response) => {
      toast.success(response.message);
    },

    onError: (error) => {
      toast.error(error.message);
      console.log(error);
    },
  });

  return {
    resetPassword: mutateAsync,
    isLoading: isPending,
  };
};

export default useResetPassword;
