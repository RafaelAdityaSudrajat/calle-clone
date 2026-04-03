import { useEffect } from "react";
import BackDrop from "../../shared/ui/BackDrop";
import CartItem from "./CartItem";

interface SideCartProps {
  cartTrigger: boolean;
  onClose: () => void;
}

function SideCart({ cartTrigger, onClose }: SideCartProps) {

  useEffect(() => {
    if (cartTrigger) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
    }

    // cleanup (penting!)
    return () => {
      document.body.style.overflow = "auto";
    };
  }, [cartTrigger]);

  return (
    <BackDrop trigger={cartTrigger} onClose={onClose}>
      <div
        className={`absolute top-0 right-0 z-50 min-h-screen w-[95%] max-w-[25rem] bg-white
          transform transition-transform duration-300 ease-out
         ${cartTrigger ? "translate-x-0" : "translate-x-full"}
        `}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Panel */}
        <CartItem onClose={onClose} />
      </div>
    </BackDrop>
  );
}

export default SideCart;
