// AuthModalContext.tsx
import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";

type AuthPopupType = "" | "login" | "register";

interface AuthModalContextType {
  activeAuthPopup: AuthPopupType;
  onCloseActiveAuthPopup: () => void;
  handleActiveAuthPopup: (value: AuthPopupType) => void;
}

const AuthModalContext = createContext<AuthModalContextType | undefined>(
  undefined,
);

export const AuthModalProvider = ({ children }: { children: ReactNode }) => {
  const [activeAuthPopup, setActiveAuthPopup] = useState<AuthPopupType>("");
  const onCloseActiveAuthPopup = () => {
    setActiveAuthPopup("");
  };

  const handleActiveAuthPopup = (value: AuthPopupType) => {
    setActiveAuthPopup(value);
  };

  return (
    <AuthModalContext.Provider
      value={{ activeAuthPopup, onCloseActiveAuthPopup, handleActiveAuthPopup }}
    >
      {children}
    </AuthModalContext.Provider>
  );
};

export const useAuthModal = () => {
  const context = useContext(AuthModalContext);
  if (!context) {
    throw new Error("useAuthModal must be used inside AuthModalProvider");
  }
  return context;
};
