import PopupAuthCardLayout from "./PopupAuthCardLayout";
import { useForm } from "react-hook-form";
import { registerSchema, type RegisterInput } from "./RegisterSchema";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useAuthModal } from "./AuthModalContext";
import HeaderPopupAuth from "./HeaderPopupAuth";
import FormRegister from "./FormRegister";
import { useRegister } from "@/features/auth/model/use-register"; // ← tambah ini

const PopupRegister = () => {
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] =
    useState<boolean>(false);

  const { handleActiveAuthPopup } = useAuthModal();
  const { register: registerUser, isLoading, error } = useRegister();

  const handleShowPassword = () => setShowPassword((prev) => !prev);
  const handleConfirmPassword = () => setShowConfirmPassword((prev) => !prev);

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

        {/* Global error dari server, misal email sudah terdaftar */}
        {error && (
          <p className="mb-4 text-xs text-center text-red-500">{error}</p>
        )}

        <FormRegister
          register={register}
          errors={errors}
          isValid={isValid}
          IsSubmit={isSubmitting || isLoading}
          handleSubmit={handleSubmit}
          showPassword={showPassword}
          handleShowPassword={handleShowPassword}
          showConfirmPassword={showConfirmPassword}
          handleConfirmPassword={handleConfirmPassword}
          onSubmit={onSubmit}
        />

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
