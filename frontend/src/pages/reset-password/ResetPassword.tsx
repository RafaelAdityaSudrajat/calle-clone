import ResetPasswordForm from "@/features/auth/reset-password/ui/ResetPasswordForm";

const ResetPassword = () => {
  return (
    <section className="flex justify-center items-center w-full h-screen flex-col gap-3">
      <h2 className="text-black lg:text-2xl">Silahkan Masukan Password Baru</h2>{" "}
      <ResetPasswordForm />
    </section>
  );
};

export default ResetPassword;
