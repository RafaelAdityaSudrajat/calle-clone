import BackDrop from "../../shared/ui/BackDrop";
import CartList from "../../features/cart/ui/Cartlist";

interface SideCartProps {
  cartTrigger: boolean;
  onClose: () => void;
}

function SideCart({ cartTrigger, onClose }: SideCartProps) {
  

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
        <CartList onClose={onClose} />
      </div>
    </BackDrop>
  );
}

export default SideCart;
