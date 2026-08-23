import { FullPageSpinner } from "@/shared/ui/Spinner";
import { AppRouter } from "./routes/router";
import { useAuthInit } from "@/features/auth/model/use-auth-init";

export default function App() {
  const { isAuthLoading } = useAuthInit();

  if (isAuthLoading) {
    return <FullPageSpinner />; // atau <LoadingScreen /> kalau punya komponen loading
  }

  return <AppRouter />;
}
