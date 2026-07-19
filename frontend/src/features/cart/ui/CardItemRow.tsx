import CartDescription from "../../../entities/cart/ui/CartDescription";
import CartAction from "../addToCart/ui/CartAction";
import type { CartItem } from "../../../entities/cart/model/cart.types";

interface CardCartProps {
  cartItem: CartItem;
}

const CardItemRow = ({ cartItem }: CardCartProps) => {
  return (
    <div className="flex flex-col">
      <CartDescription cartItem={cartItem} />

      <CartAction quantity={cartItem.quantity} />
    </div>
  );
};

export default CardItemRow;
