import PopupAuthCardLayout from "./PopupAuthCardLayout";
import { useForm } from "react-hook-form";
import { registerSchema, type RegisterInput } from "./RegisterSchema";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useAuthModal } from "./AuthModalContext";
import HeaderPopupAuth from "./HeaderPopupAuth";
import FormRegister from "./FormRegister";

const PopupRegister = () => {
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] =
    useState<boolean>(false);

  const { handleActiveAuthPopup, onCloseActiveAuthPopup } = useAuthModal();

  const handleShowPassword = () => {
    setShowPassword((prev) => !prev);
  };

  const handleConfirmPassword = () => {
    setShowConfirmPassword((prev) => !prev);
  };

  const {
    register,
    handleSubmit,
    formState: { errors, isValid, isSubmitting },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    mode: "onChange", // penting
  });

  const onSubmit = (data: RegisterInput) => {
    console.log("Data valid:", data);
    onCloseActiveAuthPopup();
  };

  return (
    <PopupAuthCardLayout>
      {/* Modal */}
      <div className="w-full max-w-md bg-white rounded-xl">
        {/* Header Register */}
        <HeaderPopupAuth label="Register" />

        {/* Description */}
        <p className="mb-6 text-xs leading-relaxed text-black">
          Create account to be our member to earn points, get free vouchers, and
          hear our news earlier.
        </p>

        {/* Form */}
        <FormRegister
          register={register}
          errors={errors}
          isValid={isValid}
          IsSubmit={isSubmitting}
          handleSubmit={handleSubmit}
          showPassword={showPassword}
          handleShowPassword={handleShowPassword}
          showConfirmPassword={showConfirmPassword}
          handleConfirmPassword={handleConfirmPassword}
          onSubmit={onSubmit}
        />
        {/* Login Link */}
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
