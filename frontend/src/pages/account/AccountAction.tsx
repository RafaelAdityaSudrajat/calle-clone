import { useAuthModal } from "../../feature/auth/AuthModalContext";


const AccountAction = () => {

  const { handleActiveAuthPopup } = useAuthModal()
  
  return (
    <div className="flex gap-3 text-xs">
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
    </div>
  );
};

export default AccountAction;
