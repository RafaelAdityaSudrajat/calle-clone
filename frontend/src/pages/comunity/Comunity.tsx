import LayoutPrimary from "../../layout/LayoutPrimary";
import imageOne from "@/assets/images/communityImage/image_one.webp";
import imageTwo from "@/assets/images/communityImage/image_two.webp";
import imageThree from "@/assets/images/communityImage/image_three.webp";
import imageFour from "@/assets/images/communityImage/image_four.webp";
import imageFive from "@/assets/images/communityImage/image_five.webp";

const Comunity = () => {
  return (
    <LayoutPrimary>
      <div className="w-full h-auto overflow-hidden">
        <img
          src={imageOne}
          alt="imageOne"
          className="object-cover w-full h-full"
        />
      </div>
      <div className="w-full h-auto overflow-hidden">
        <img
          src={imageTwo}
          alt="imageOne"
          className="object-cover w-full h-full"
        />
      </div>
      <div className="w-full h-auto overflow-hidden">
        <img
          src={imageThree}
          alt="imageOne"
          className="object-cover w-full h-full"
        />
      </div>
      <div className="w-full h-auto overflow-hidden">
        <img
          src={imageFour}
          alt="imageOne"
          className="object-cover w-full h-full"
        />
      </div>
      <div className="w-full h-auto overflow-hidden">
        <img
          src={imageFive}
          alt="imageOne"
          className="object-cover w-full h-full"
        />
      </div>
    </LayoutPrimary>
  );
};

export default Comunity;
