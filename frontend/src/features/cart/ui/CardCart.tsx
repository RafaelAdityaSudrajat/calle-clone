import CartDescription from "../entities/CartDescription";
import CartAction from "../addToCart/ui/CartAction";
import type { CartItem } from "../model/cart.types";

interface CardCartProps {
  cartItem: CartItem
}


const CardCart = ({cartItem} : CardCartProps) => {
  return (
    <div className="flex flex-col">
      <CartDescription cartItem={cartItem}/>

      <CartAction quantity={cartItem.quantity}/>
    </div>
  );
};

export default CardCart;
