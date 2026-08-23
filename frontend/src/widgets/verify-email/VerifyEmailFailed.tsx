import ButtonResendVerifyEmail from "@/features/auth/resend-verify-email/ButtonResendVerifyEmail";
import ContainerVerifyEmail from "./ContainerVerifyEmail";

const VerifyEmailFailed = () => {
  return (
    <ContainerVerifyEmail>
      <section className="text-red-500 bg-black rounded-md p-7 w-[95%] lg:max-w-[500px]">
        <p className="mb-5 text-2xl">Verifikasi gagal atau link expired.</p>
        <ButtonResendVerifyEmail />
      </section>
    </ContainerVerifyEmail>
  );
};

export default VerifyEmailFailed;
