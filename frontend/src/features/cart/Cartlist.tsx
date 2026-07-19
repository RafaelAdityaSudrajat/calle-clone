import { useCartStore } from "@/features/cart/model/cartStore";
import CardCart from "./ui/CardCart";
import CartHeader from "./CartHeader";

import { GoTrash } from "react-icons/go";
import { useGetCart } from "./hooks/useCartNew";

interface CartItemProps {
  onClose: () => void;
}

const CartList = ({ onClose }: CartItemProps) => {
  const { clearCart } = useCartStore();
  const { data: cartResponse } = useGetCart();

  const cartList = cartResponse?.data?.cartItems ?? [];




  return (
    <div className="flex flex-col h-screen max-h-screen overflow-hidden">
      <CartHeader onClose={onClose} />

      {cartList.length <= 0 ? (
        <div className="flex items-center justify-center w-full h-full">
          <span>Ngga ada Barang !!!</span>
        </div>
      ) : (
        <div className="flex flex-col h-full">
          <div className="flex-1 p-4 overflow-y-scroll border-y">
            {cartList.map((item , index) => (
              <CardCart key={index} cartItem = {item}/>
            ))}
          </div>

          <div className="flex items-center p-4">
            <div className="flex items-center gap-2 p-2 transition-all border-2 rounded-md cursor-pointer duration-5000 border-zinc-400 hover:bg-black hover:text-white hover:border-black">
              <button onClick={clearCart}>Remove All</button>
              <GoTrash />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CartList;
