import { createContext, useContext, useState, type ReactNode } from "react";

type QuantityContextType = {
  quantity: number;
  increaseQuantity: () => void;
  decreaseQuantity: () => void;
};

const QuantityContext = createContext<QuantityContextType | null>(null);

export function QuantityProvider({ children }: { children: ReactNode }) {
  const [quantity, setQuantity] = useState<number>(1);

  function decreaseQuantity() {
    if (quantity <= 1) return;
    setQuantity((prev) => prev - 1);
  }

  function increaseQuantity() {
    setQuantity((prev) => prev + 1);
  }

  return (
    <QuantityContext.Provider
      value={{ quantity, increaseQuantity, decreaseQuantity }}
    >
      {children}
    </QuantityContext.Provider>
  );
}

export function useQuantity() {
  const context = useContext(QuantityContext);

  if (!context) {
    throw new Error("useQuantity must be used inside QuantityProvider");
  }

  return context;
}
