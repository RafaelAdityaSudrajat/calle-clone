

interface AddToCartProps {
  variant : string
}


const AddToCart = ({variant = "mobile" } : AddToCartProps) => {

  const base = "w-full py-3 font-medium bg-black"

  const variants = {
    mobile: "text-white bg-black rounded-lg ",
    desktop: "rounded-full bg-white text-black border border-black hover:text-white hover:bg-black"
  }



  return (
    <div className="fixed left-0 w-full px-4 bottom-5 lg:static lg:px-0">
      <button
        className={`${base} ${variants[variant]}`}
      >
        Add to Cart
      </button>
    </div>
  );
};

export default AddToCart;
