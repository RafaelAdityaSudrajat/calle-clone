import QuantityAction from "../componentsShared/QuantityAction";
import CardCart from "./CardCart";
import CartHeader from "./CartHeader";

interface CartItemProps {
  onClose: () => void;
}

const CartItem = ({ onClose }: CartItemProps) => {
  return (
    <div className="flex flex-col gap-2">
      <CartHeader onClose={onClose} />
      
      <div className="p-4 border-y">
       <CardCart />
      </div>
    </div>
  );
};

export default CartItem;
