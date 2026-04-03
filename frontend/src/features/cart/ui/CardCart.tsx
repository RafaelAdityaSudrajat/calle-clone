import CartDescription from "../entities/CartDescription";
import CartAction from "../entities/CartAction";

const CardCart = () => {

  return (
    <div className="flex flex-col">
      <CartDescription />

      <CartAction />
    </div>
  );
};

export default CardCart;
