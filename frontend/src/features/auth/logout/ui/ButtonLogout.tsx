import { useLogout } from "../model/use-logout";

const ButtonLogout = () => {
  const { logout, isPending } = useLogout();

  const handleLogout = async () => {
    await logout();
  };
  return (
    <button
      className="px-5 py-2 font-medium text-white transition bg-black rounded-full hover:opacity-90"
      onClick={handleLogout}
      disabled={isPending}
    >
      logout
    </button>
  );
};

export default ButtonLogout;
