import CardItemRow from "./CardItemRow";
import CartHeader from "../../../entities/cart/ui/CartHeader";
import { GoTrash } from "react-icons/go";
import type { CartItem } from "@/entities/cart/model/cart.types";

interface CartItemProps {
  onClose: () => void;
  cartItems: CartItem[];
}

const CartList = ({ onClose, cartItems }: CartItemProps) => {
  return (
    <div className="flex flex-col h-screen max-h-screen overflow-hidden">
      <CartHeader onClose={onClose} />

      {cartItems.length <= 0 ? (
        <div className="flex items-center justify-center w-full h-full">
          <span>Ngga ada Barang !!!</span>
        </div>
      ) : (
        <div className="flex flex-col h-full">
          <div className="flex-1 p-4 overflow-y-scroll border-y">
            {cartItems.map((item, index) => (
              <CardItemRow key={index} cartItem={item} />
            ))}
          </div>

          <div className="flex items-center p-4">
            <div className="flex items-center gap-2 p-2 transition-all border-2 rounded-md cursor-pointer duration-5000 border-zinc-400 hover:bg-black hover:text-white hover:border-black">
              <button>Remove All</button>
              <GoTrash />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CartList;
