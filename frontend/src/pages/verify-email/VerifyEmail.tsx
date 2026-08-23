import VerifyEmailSuccess from "@/widgets/verify-email/VerifyEmailSuccess";
import VerifyEmailFailed from "@/widgets/verify-email/VerifyEmailFailed";
import VerifyEmailLoading from "@/widgets/verify-email/VerifyEmailLoading";
import useVerifyEmail from "@/features/auth/verify-email/hooks/useVerifyEmail";

export function VerifyEmailPage() {
  const { status } = useVerifyEmail();

  if (status === "loading") {
    return <VerifyEmailLoading />;
  }

  if (status === "success") {
    return <VerifyEmailSuccess />;
  }

  return <VerifyEmailFailed />;
}
