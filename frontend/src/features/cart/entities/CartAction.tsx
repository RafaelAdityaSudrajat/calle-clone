import QuantityAction from "../handleQuantity/QuantityAction"
import RemoveButon from "../removeFromCart/ui/RemoveButon"

const CartAction = () => {
  return (
   <div className="flex items-center justify-between w-full mt-4">
        <div className="flex items-center gap-4">
          <RemoveButon />
        </div>

        <QuantityAction />
      </div>
  )
}

export default CartAction
