import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { authApi } from "../api/auth.api";
import { useAuthStore } from "@/features/auth/model/auth.store";

export function useAuthInit() {
  const setUser = useAuthStore((state) => state.setUser);
  const clearUser = useAuthStore((state) => state.clearUser);

  const { data, isError, isLoading } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: authApi.getMe,
    retry: false,
    staleTime: Infinity,
  });

  useEffect(() => {
    if (data?.user) {
      setUser(data.user);
    } else if (isError) {
      clearUser();
    }
  }, [data, isError, setUser, clearUser]);

  return { isAuthLoading: isLoading };
}