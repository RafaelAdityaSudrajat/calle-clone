import { useCart } from "@/features/cart/hooks/useCart";
import { RiShoppingBagLine } from "react-icons/ri";

interface CartProps {
  handleCart: () => void;
}

const Cart = ({ handleCart }: CartProps) => {
  const { items } = useCart();

  return (
    <div className="relative flex items-center">
      <button className="md:hidden">
        <RiShoppingBagLine className="w-6 h-6" onClick={handleCart} />
      </button>
      <button className="hidden md:block" onClick={handleCart}>
        CART
      </button>
      <div className="w-[23px] h-[23px] flex items-center justify-center text-white bg-black rounded-full text-[.9em] absolute top-[-10px] right-[-15px] p-[.5rem]">
        {items.length}
      </div>
    </div>
  );
};

export default Cart;
