import CardItemRow from "./CardItemRow";
import CartHeader from "../../../entities/cart/ui/CartHeader";

import { GoTrash } from "react-icons/go";
import { useGetCart } from "../../../entities/cart/model/UseCart";
import axios from "axios";

interface CartItemProps {
  onClose: () => void;
}

const CartList = ({ onClose }: CartItemProps) => {
  const { data: cartResponse, isLoading, isError, error } = useGetCart();

  let errorMessage = "Terjadi kesalahan";

  if (axios.isAxiosError(error)) {
    if (error.response?.status === 401) {
      errorMessage = "Silakan login terlebih dahulu";
    } else {
      errorMessage =
        error.response?.data?.message ??
        "Terjadi kesalahan saat mengambil keranjang";
    }
  }

  console.log(error?.message);

  const cartList = cartResponse?.data?.cartItems ?? [];

  if (isLoading) {
    return (
      <div className="flex flex-col h-screen max-h-screen">
        <CartHeader onClose={onClose} />
        <div className="flex items-center justify-center flex-1">
          Memuat data...
        </div>
      </div>
    );
  }

  // 2. Jika error, handle di sini
  if (isError) {
    return (
      <div className="flex flex-col h-screen max-h-screen">
        <CartHeader onClose={onClose} />
        <div className="flex items-center justify-center flex-1 text-red-500">
          {errorMessage}
        </div>
      </div>
    );
  }

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
            {cartList.map((item, index) => (
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
