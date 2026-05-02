import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { authApi } from "../api/auth.api";
import { useAuthStore } from "@/features/auth/model/auth.store";

export function useLogout() {
  const navigate = useNavigate();
  const clearUser = useAuthStore((state) => state.clearUser);
  const queryClient = useQueryClient();

  const { mutate: logout, isPending } = useMutation({
    mutationFn: authApi.logout,

    onSuccess: () => {
      clearUser();                                    // ← kosongkan Zustand store
      queryClient.removeQueries({ queryKey: ["auth", "me"] }); // ← buang cache
      navigate("/");
    },

    onError: () => {
      // Tetap clear local state meskipun backend error
      // supaya user ga stuck di state "login" padahal session udah mati
      clearUser();
      queryClient.removeQueries({ queryKey: ["auth", "me"] });
      navigate("/about");
    },
  });

  return { logout, isLoading: isPending };
}