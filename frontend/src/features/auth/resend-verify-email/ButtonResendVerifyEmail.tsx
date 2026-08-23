import { useResendVerifyEmail } from "./hooks/useResendVerifyEmail";

const ButtonResendVerifyEmail = () => {
  const { resendVerifyEmail, isPending } = useResendVerifyEmail();

  const handleResend = async () => {
    await resendVerifyEmail();
  };

  return (
    <button
      onClick={handleResend}
      disabled={isPending}
      className="text-sm text-white underline hover:text-blue-700 transition-all duration-100"
    >
      {isPending ? "Mengirim..." : " belum menerima email ? klik di sini"}
    </button>
  );
};

export default ButtonResendVerifyEmail;
