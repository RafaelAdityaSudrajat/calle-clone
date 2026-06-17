import LayoutPrimary from "@/widgets/layout/LayoutPrimary";
import imageOne from "@/shared/assets/images/communityImage/image_one.webp";
import imageTwo from "@/shared/assets/images/communityImage/image_two.webp";
import imageThree from "@/shared/assets/images/communityImage/image_three.webp";
import imageFour from "@/shared/assets/images/communityImage/image_four.webp";
import imageFive from "@/shared/assets/images/communityImage/image_five.webp";

const images = [
  { src: imageOne, alt: "Community image 1" },
  { src: imageTwo, alt: "Community image 2" },
  { src: imageThree, alt: "Community image 3" },
  { src: imageFour, alt: "Community image 4" },
  { src: imageFive, alt: "Community image 5" },
];

const Comunity = () => {
  return (
    <LayoutPrimary>
      {images.map((img) => (
        <div key={img.alt} className="w-full h-auto overflow-hidden">
          <img
            src={img.src}
            alt={img.alt}
            className="object-cover w-full h-full"
          />
        </div>
      ))}
    </LayoutPrimary>
  );
};

export default Comunity;
