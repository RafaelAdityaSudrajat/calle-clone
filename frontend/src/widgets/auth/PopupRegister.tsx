import PopupAuthCardLayout from "../../features/auth/ui/PopupAuthCardLayout";
import { useForm } from "react-hook-form";
import { registerSchema, type RegisterInput } from "../../features/auth/register/model/RegisterSchema";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useAuthModal } from "../../features/auth/ui/AuthModalContext";
import HeaderPopupAuth from "../../features/auth/ui/HeaderPopupAuth";
import FormRegister from "../../features/auth/register/ui/FormRegister";
import { useRegister } from "@/features/auth/register/model/use-register"; // ← tambah ini

const PopupRegister = () => {
  const [showPassword, setShowPassword] = useState<boolean>(false);

  const { handleActiveAuthPopup } = useAuthModal();
  const { register: registerUser, isLoading, error } = useRegister();

  const handleShowPassword = () => setShowPassword((prev) => !prev);

  const {
    register,
    handleSubmit,
    formState: { errors, isValid, isSubmitting },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    mode: "onChange",
  });

  const onSubmit = async (data: RegisterInput) => {
    await registerUser(data);
  };

  return (
    <PopupAuthCardLayout>
      <div className="w-full max-w-md bg-white rounded-xl">
        <HeaderPopupAuth label="Register" />

        <p className="mb-6 text-xs leading-relaxed text-black">
          Create account to be our member to earn points, get free vouchers, and
          hear our news earlier.
        </p>

        <FormRegister
          register={register}
          errors={errors}
          isValid={isValid}
          IsSubmit={isSubmitting || isLoading}
          handleSubmit={handleSubmit}
          showPassword={showPassword}
          handleShowPassword={handleShowPassword}
          onSubmit={onSubmit}
        />

        {/* Global error dari server, misal email sudah terdaftar */}
        {error && (
          <p className="mt-4 text-xs text-center text-red-500">{error}</p>
        )}

        <p className="pt-2 text-sm text-center text-gray-600">
          Already have account?{" "}
          <span
            className="font-medium text-gray-800 cursor-pointer hover:underline"
            onClick={() => handleActiveAuthPopup("login")}
          >
            Login here
          </span>
        </p>
      </div>
    </PopupAuthCardLayout>
  );
};

export default PopupRegister;
