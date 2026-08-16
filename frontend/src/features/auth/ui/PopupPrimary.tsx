import type { ReactNode } from "react";
import BackdropAuth from "@/features/auth/ui/BackdropAuth";
import { useAuthModal } from "@/features/auth/ui/AuthModalContext";

interface BackdropAuthProps {
  children: ReactNode;
}

const PopupPrimary = ({ children }: BackdropAuthProps) => {
  const { activeAuthPopup } = useAuthModal();
  return (
    <BackdropAuth>
      <div
        className={`absolute bottom-0 md:bottom-[50%] md:translate-y-[50%] right-1/2 translate-x-1/2 w-[95%] max-w-[30rem]
           bg-white border rounded-t-3xl md:rounded-3xl border-zinc-200
            h-auto max-h-[90vh] overflow-y-scroll scrollbar-hide
             transform transition-transform duration-500 ease-out
         ${activeAuthPopup ? "translate-y-0" : "translate-y-full"}
  `}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </BackdropAuth>
  );
};

export default PopupPrimary;
