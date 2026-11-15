import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/entities/user/store/auth.store";
import { logoutApi } from "../api/logout.api";

export function useLogout() {
  const navigate = useNavigate();
  const { clearUser } = useAuthStore();

  const { mutate: logout, isPending } = useMutation({
    mutationFn: logoutApi,

    onSuccess: () => {
      clearUser(); // ← kosongkan Zustand store
      navigate("/");
    },

    onError: () => {
      // Tetap clear local state meskipun backend error
      // supaya user ga stuck di state "login" padahal session udah mati
      clearUser();
      navigate("/about");
    },
  });

  return { logout, isPending };
}
