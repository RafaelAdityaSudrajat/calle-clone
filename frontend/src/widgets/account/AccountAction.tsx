import { useAuthModal } from "@/features/auth/ui/AuthModalContext";
import { useAuthStore } from "@/entities/user/store/auth.store";
import ButtonLogout from "@/features/auth/logout/ui/ButtonLogout";

const AccountAction = () => {
  const { handleActiveAuthPopup } = useAuthModal();
  const { isAuthenticated } = useAuthStore();

  return (
    <div className="flex gap-3 text-xs">
      {!isAuthenticated ? (
        <>
          <button
            className="px-5 py-2 font-medium transition border border-gray-300 rounded-full hover:bg-gray-100"
            onClick={() => handleActiveAuthPopup("login")}
          >
            Login
          </button>
          <button
            className="px-5 py-2 font-medium text-white transition bg-black rounded-full hover:opacity-90"
            onClick={() => handleActiveAuthPopup("register")}
          >
            Register
          </button>
        </>
      ) : (
        <ButtonLogout />
      )}
    </div>
  );
};

export default AccountAction;
