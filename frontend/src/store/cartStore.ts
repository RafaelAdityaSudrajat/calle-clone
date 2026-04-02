import { create } from "zustand";
import { devtools } from "zustand/middleware";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Product {
  id: string;
  name: string;
  price: number;
  image?: string;
}

export interface CartItem extends Product {
  quantity: number;
}

interface CartState {
  items: CartItem[];

  // Actions
  addToCart: (product: Product, quantity?: number) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string) => void;
  clearCart: () => void;

  // Selectors
  getTotalItems: () => number;
  getTotalPrice: () => number;
  getItemById: (productId: string) => CartItem | undefined;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useCartStore = create<CartState>()(
  devtools((set, get) => ({
    items: [],

    // ── Add to cart ─────────────────────────────────────────────────────────────
    // Kalau produk sudah ada di cart, tambahkan quantity-nya
    // Kalau belum ada, tambahkan sebagai item baru
    addToCart: (product, quantity = 1) => {
      if (quantity <= 0) return;

      set((state) => {
        const existingItem = state.items.find((item) => item.id === product.id);

        if (existingItem) {
          return {
            items: state.items.map((item) =>
              item.id === product.id
                ? { ...item, quantity: item.quantity + quantity }
                : item,
            ),
          };
        }

        return {
          items: [...state.items, { ...product, quantity }],
        };
      });
    },

    // ── Remove from cart ─────────────────────────────────────────────────────────
    removeFromCart: (productId) => {
      set((state) => ({
        items: state.items.filter((item) => item.id !== productId),
      }));
    },

    // ── Update quantity ──────────────────────────────────────────────────────────
    // Kalau quantity <= 0, produk otomatis dihapus dari cart
    updateQuantity: (productId) => {
      // if (quantity <= 0) {
      //   get().removeFromCart(productId);
      //   return;
      // }

      set((state) => ({
        items: state.items.map((item) =>
          item.id === productId
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        ),
      }));
    },

    // ── Clear cart ───────────────────────────────────────────────────────────────
    clearCart: () => set({ items: [] }),

    // ── Selectors ────────────────────────────────────────────────────────────────
    getTotalItems: () => {
      return get().items.reduce((total, item) => total + item.quantity, 0);
    },

    getTotalPrice: () => {
      return get().items.reduce(
        (total, item) => total + item.price * item.quantity,
        0,
      );
    },

    getItemById: (productId) => {
      return get().items.find((item) => item.id === productId);
    },
  })),
);
