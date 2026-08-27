import useResetPassword from "@/features/auth/reset-password/hooks/useResetPassword";
import {
  resetPasswordSchema,
  type ResetPasswordInput,
} from "@/features/auth/reset-password/model/ResetPasswordSchema";
import InputField from "@/shared/ui/InputField";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

const ResetPasswordForm = () => {
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),

    defaultValues: {
      newPassword: "",
      confirmPassword: "",
    },
  });

  const { resetPassword, isLoading } = useResetPassword();

  const onSubmit = async (data: ResetPasswordInput) => {
    await resetPassword(data);

    reset();
  };

  return (
    <div className="w-full p-4 bg-white border shadow-sm border-slate-100 rounded-xl lg:max-w-[50%]">
      <form onSubmit={handleSubmit(onSubmit)} className="max-w-full">
        {/* New Password */}
        <div className="grid grid-cols-1 md:grid-cols-1 gap-x-8">
          <InputField
            label="newPassword"
            placeholder="Enter New Password"
            {...register("newPassword")}
          />

          {errors.newPassword && (
            <p className="mb-4 -mt-4 text-xs text-red-500">
              {errors.newPassword.message}
            </p>
          )}
        </div>

        {/* Confirm Password */}
        <div className="grid grid-cols-1 md:grid-cols-1 gap-x-8">
          <InputField
            label="Konfirrmasi Password"
            placeholder="Enter Konfirmasi Password"
            {...register("confirmPassword")}
          />

          {errors.newPassword && (
            <p className="mb-4 -mt-4 text-xs text-red-500">
              {errors.newPassword.message}
            </p>
          )}
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={isLoading}
          className="bg-dashboardTextPrimary hover:bg-slate-800 text-white px-8 py-3 rounded-lg text-[15px] font-semibold transition-all shadow-sm active:scale-95"
        >
          {isLoading ? "Mengubah password..." : "Reset password"}
        </button>
      </form>
    </div>
  );
};

export default ResetPasswordForm;
