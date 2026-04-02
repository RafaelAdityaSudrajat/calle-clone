import { useCartStore } from "@/store/cartStore";
import { Link } from "react-router-dom";

interface ProductCardProps {
  id: string;
  title: string;
  price: number;
}

const ProductCard = ({ id = "1", title, price }: ProductCardProps) => {
  const { addToCart } = useCartStore();

  const handleAddCart = () => {


    console.log("clickk")
    const product = {
      id,
      name: title,
      price,
    };

    console.log(product)

    addToCart(product, 1);
  };

  return (
    <div className="px-3 rounded-md">
      <div className="flex flex-col p-0">
        <Link to={`/products/${id}`} className="flex justify-center">
          <img
            src="https://d2kchovjbwl1tk.cloudfront.net/vendor/9549/product/1_1766377064172_resized1024-jpg.webp"
            alt="products 1"
            className="w-full"
          />
        </Link>
        <div className="text-[clamp(.5rem,2vw,.8rem)] text-zinc-800 flex flex-col gap-2 text-start items-center md:items-start md:px-5">
          <p className="text-center md:text-start">{title}</p>
          <div className="flex items-center justify-between w-[100%]">
            <p className="items-start text-center md:text-start">
              Rp {price.toLocaleString("id-ID")}
            </p>

            <button
              className="p-1 px-2 text-white transition-all duration-500 bg-black rounded-md hover:bg-white hover:text-black hover:border"
              onClick={handleAddCart}
            >
              Add to Cart
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductCard;
