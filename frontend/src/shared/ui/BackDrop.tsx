import type { ReactNode } from "react";

interface BackDropProps {
  trigger: boolean;
  onClose: () => void;
  children: ReactNode;
}

const BackDrop = ({ trigger, onClose, children }: BackDropProps) => {
  return (
    <div
      className={`fixed inset-0 z-40 bg-black/40 transition-opacity duration-100
        ${
          trigger
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        }
      `}
      onClick={onClose}
    >
      {children}
    </div>
  );
};

export default BackDrop;
