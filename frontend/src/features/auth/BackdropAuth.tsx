import { type ReactNode } from "react";
import { useAuthModal } from "./AuthModalContext";

interface BackdropAuthProps {
  children: ReactNode;
}

const BackdropAuth = ({ children }: BackdropAuthProps) => {
  const { onCloseActiveAuthPopup, activeAuthPopup } = useAuthModal();

  return (
    <div
      className={`fixed inset-0 z-40 bg-black/40 transition-opacity duration-100
        ${
          activeAuthPopup
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        }
      `}
      onClick={onCloseActiveAuthPopup}
    >
      {children}
    </div>
  );
};

export default BackdropAuth;
