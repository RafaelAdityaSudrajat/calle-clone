import type { ReactNode } from "react";
import PopupPrimary from "../../components/componentsShared/PopupPrimary";

interface PopupAuthCardLayoutProps {
  children: ReactNode;
}

const PopupAuthCardLayout = ({
  children,
}: PopupAuthCardLayoutProps) => {
  return (
    <PopupPrimary>
      {/* Card */}
      <div className="relative p-6 bg-white shadow-xl rounded-2xl">
        {children}
      </div>
    </PopupPrimary>
  );
};

export default PopupAuthCardLayout;
