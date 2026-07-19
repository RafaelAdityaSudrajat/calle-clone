import QuantityAction from "./QuantityAction";
import RemoveButon from "../../removeFromCart/ui/RemoveButon";

interface CartActionProps {
  quantity: number;
}

const CartAction = ({ quantity }: CartActionProps) => {
  return (
    <div className="flex items-center justify-between w-full mt-4">
      <div className="flex items-center gap-4">
        <RemoveButon />
      </div>

      <QuantityAction quantity={quantity}/>
    </div>
  );
};

export default CartAction;
