import { CiLock, CiUser } from "react-icons/ci";
import { IoEyeOffOutline, IoEyeOutline } from "react-icons/io5";
import type { FieldErrors, UseFormRegister } from "react-hook-form";
import type { LoginInput } from "./LoginScema";

interface FormLoginProps {
  register: UseFormRegister<LoginInput>;
  errors: FieldErrors<LoginInput>;
  isValid: boolean;
  IsSubmit: boolean;
  handleSubmit: any; // bisa kamu typing lebih proper nanti
  showPassword: boolean;
  handleShowPassword: () => void;
  onSubmit: (data: LoginInput) => void;
}

const FormLogin = ({
  register,
  errors,
  isValid,
  IsSubmit,
  handleSubmit,
  showPassword,
  handleShowPassword,
  onSubmit,
}: FormLoginProps) => {
  return (
    <form className="space-y-4 text-xs" onSubmit={handleSubmit(onSubmit)}>
      {/* EMAIL */}
      <div className="">
        <div className="flex items-center gap-1 border border-gray-300 rounded-lg">
          <CiUser className="w-10 text-[1rem]" />

          <input
            type="email"
            placeholder="Your email"
            className="flex-1 w-full py-3 text-sm outline-none focus:outline-none"
            {...register("email")}
          />
        </div>

        {errors.email && (
          <p className="m-2 text-xs text-red-500">{errors.email.message} !!!</p>
        )}
      </div>

      {/* PASSWORD */}
      <div className="">
        <div className="flex items-center gap-1 border border-gray-300 rounded-lg">
          <CiLock className="w-10 text-[1rem]" />

          <input
            type={showPassword ? "text" : "password"}
            placeholder="Your password"
            className="flex-1 w-full py-3 text-sm outline-none focus:outline-none"
            {...register("password")}
          />

          {!showPassword && (
            <IoEyeOutline
              className="w-10 text-[1rem] cursor-pointer"
              onClick={handleShowPassword}
            />
          )}

          {showPassword && (
            <IoEyeOffOutline
              className="w-10 text-[1rem] cursor-pointer"
              onClick={handleShowPassword}
            />
          )}
        </div>
        {errors.password && (
          <p className="m-2 text-xs text-red-500">
            {errors.password.message} !!!
          </p>
        )}
      </div>

      <button
        type="submit"
        className="w-full py-3 mt-4 font-medium text-white bg-blue-500 rounded-lg disabled:bg-gray-400 disabled:cursor-not-allowed"
        disabled={!isValid || IsSubmit}
      >
        Log In
      </button>
    </form>
  );
};

export default FormLogin;
