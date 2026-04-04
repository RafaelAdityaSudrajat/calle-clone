import { useCartStore, type Product as CartProduct } from "@/features/cart/model/cartStore";

export const useAddToCart = () => {
  const addToCart = useCartStore((state) => state.addToCart);

  const handleAddToCart = (product: CartProduct, quantity = 1) => {
    if (quantity <= 0) return;

    addToCart(product, quantity);
    window.alert("Product ditambahkan di keranjang");
  };

  return {
    handleAddToCart,
  };
};
