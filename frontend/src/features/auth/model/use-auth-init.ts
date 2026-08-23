import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { authApi } from "@/entities/user/api/auth.api";
import { useAuthStore } from "@/entities/user/store/auth.store";

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
    if (data?.data) {
      setUser(data.data);
    } else if (isError) {
      clearUser();
    }
  }, [data, isError, setUser, clearUser]);

  return { isAuthLoading: isLoading };
}
