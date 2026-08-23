import { toast } from "sonner";
import { useMutation } from "@tanstack/react-query";
import {
  resendVerifyEmailApi,
  type resendVerifyEmailResponse,
} from "../api/resend.verify.email.api";

export function useResendVerifyEmail() {
  const {
    mutateAsync: resendVerifyEmail,
    isPending,
    error,
  } = useMutation({
    mutationFn: resendVerifyEmailApi,

    onSuccess: (response: resendVerifyEmailResponse) => {
      toast.success(response.message);
    },

    onError: (error) => {
      console.error(error);
      toast.error("Gagal mengirim ulang email verifikasi");
    },
  });

  return {
    resendVerifyEmail,
    isPending,
    error,
  };
}
