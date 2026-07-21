import { useAddCart } from "@/entities/cart/model/UseCart";
import ButtonPrimary from "@/shared/ui/ButtonPrimary";
import type { updateCartInputValues } from "../model/cart.schema";

interface ButtonAddToCartProps {
  valueAddToCart: updateCartInputValues;
}

const ButtonAddToCart = ({ valueAddToCart }: ButtonAddToCartProps) => {
  const { mutateAsync: AddTocart } = useAddCart();

  const handleAddToCart = async (data: updateCartInputValues) => {
    console.log(data);
    try {
      const datas = await AddTocart(data);

      console.log(datas);
    } catch (error) {
      if (error instanceof Error) {
        console.log(error.message);
      }
    }
  }; 

  const onSubmit = () => {
    handleAddToCart(valueAddToCart)
  }

  return <ButtonPrimary title={"Add To Cart"} handleFunction={onSubmit}/>;
};

export default ButtonAddToCart;
