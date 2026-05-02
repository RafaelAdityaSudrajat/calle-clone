import { useAuthModal } from "@/features/auth/AuthModalContext";
import { useAuthStore } from "@/features/auth/model/auth.store";
import { useLogout } from "@/features/auth/model/use-logout";

const AccountAction = () => {
  const { handleActiveAuthPopup } = useAuthModal();
  const { isAuthenticated } = useAuthStore();
  const {logout} = useLogout()

  const handleLogout = async () => {
    await logout()
  }

  console.log(isAuthenticated);

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
            Signup
          </button>
        </>
      ) : (
        <button className="px-5 py-2 font-medium text-white transition bg-black rounded-full hover:opacity-90" onClick={handleLogout}>
          logout
        </button>
      )}
    </div>
  );
};

export default AccountAction;
