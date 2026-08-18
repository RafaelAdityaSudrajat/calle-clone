
import VerifyEmailSuccess from "@/features/auth/verify-email/ui/VerifyEmailSuccess";
import VerifyEmailFailed from "@/features/auth/verify-email/ui/VerifyEmailFailed";
import VerifyEmailLoading from "@/features/auth/verify-email/ui/VerifyEmailLoading";
import useVerifyEmail from "@/features/auth/verify-email/hooks/useVerifyEmail";

export function VerifyEmailPage() {
  const {status} = useVerifyEmail()

  if (status === "loading") {
    return <VerifyEmailLoading />;
  }

  if (status === "success") {
    return <VerifyEmailSuccess />;
  }

  return <VerifyEmailFailed />;
}
