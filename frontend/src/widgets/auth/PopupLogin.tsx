import PopupAuthCardLayout from "../../features/auth/ui/PopupAuthCardLayout";
import { loginSchema, type LoginInput } from "../../features/auth/login/model/LoginScema";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";

import { useAuthModal } from "../../features/auth/ui/AuthModalContext";
import HeaderPopupAuth from "../../features/auth/ui/HeaderPopupAuth";
import FormLogin from "../../features/auth/login/ui/FormLogin";
import { useLogin } from "../../features/auth/login/model/use-login";

const PopupLogin = () => {
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const { handleActiveAuthPopup } = useAuthModal();
  const { login, isLoading, error } = useLogin();

  const {
    register,
    handleSubmit,
    formState: { errors, isValid, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    mode: "onChange", // penting
  });

  const handleShowPassword = () => {
    setShowPassword((prev) => !prev);
  };

  const onSubmit = async (data: LoginInput) => {
    await login(data);
  };

  return (
    <PopupAuthCardLayout>
      {/* Header */}
      <HeaderPopupAuth label="Log in" />
      {/* Input */}
      <FormLogin
        register={register}
        errors={errors}
        isValid={isValid}
        IsSubmit={isSubmitting || isLoading}
        handleSubmit={handleSubmit}
        showPassword={showPassword}
        handleShowPassword={handleShowPassword}
        onSubmit={onSubmit}
      />

      {/* Button */}

      {/* Signup */}
      <p className="mt-6 text-sm text-center text-gray-700">
        Don't have account?{" "}
        <span
          className="font-semibold cursor-pointer hover:underline"
          onClick={() => handleActiveAuthPopup("register")}
        >
          Signup here
        </span>
      </p>

      {/* Footer */}
      <p className="text-[12px] text-gray-500 text-center mt-6 leading-snug">
        This site is protected by reCAPTCHA and the Google{" "}
        <span className="underline cursor-pointer">Privacy Policy</span> and{" "}
        <span className="underline cursor-pointer">Terms of Service</span>.
      </p>

      {error && (
        <p className="mb-4 text-xs text-center text-red-500">{error}</p>
      )}
    </PopupAuthCardLayout>
  );
};

export default PopupLogin;
