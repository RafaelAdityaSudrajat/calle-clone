import { useCartStore } from "@/features/cart/model/cartStore"; // sesuaikan path

export const useCart = () => {
  const items = useCartStore((state) => state.items);

  // Actions
  const addToCart = useCartStore((state) => state.addToCart);
  const removeFromCart = useCartStore((state) => state.removeFromCart);
  const increaseQuantity = useCartStore((state) => state.increaseQuantity);
  const decreaseQuantity = useCartStore((state) => state.decreaseQuantity);
  const clearCart = useCartStore((state) => state.clearCart);

  // Selectors
  const totalItems = useCartStore((state) => state.getTotalItems());
  const totalPrice = useCartStore((state) => state.getTotalPrice());
  const getItemById = useCartStore((state) => state.getItemById);

  return {
    items,

    // actions
    addToCart,
    removeFromCart,
    increaseQuantity,
    decreaseQuantity,
    clearCart,

    // selectors
    totalItems,
    totalPrice,
    getItemById,
  };
};
