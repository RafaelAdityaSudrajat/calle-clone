import type { ProductResponse } from "@/entities/product";
import { useProductGalerry } from "../hooks/use-productGalerry";

interface ProductGalleryProps {
  product: ProductResponse;
}

const ProductGallery = ({ product }: ProductGalleryProps) => {
  const {
    imageRef,
    handleMouseEnter,
    handleMouseLeave,
    handleMouseMove,
    primaryImage,
    showZoom,
    zoomPosition,
    galleryImages,
    handlePrimaryImage,
  } = useProductGalerry({ product });

  return (
    <div className="flex flex-col w-full gap-2">
      <div
        ref={imageRef}
        className="aspect-[1/1] bg-gray-100 rounded-lg flex items-center justify-center relative overflow-hidden cursor-crosshair"
        onMouseMove={handleMouseMove}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <img
          src={primaryImage}
          alt=""
          className="object-cover w-full h-full"
          style={{ opacity: showZoom ? 0.5 : 1 }}
        />

        {showZoom && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: `url(${primaryImage})`,
              backgroundSize: "150%",
              backgroundPosition: `${zoomPosition.x}% ${zoomPosition.y}%`,
              backgroundRepeat: "no-repeat",
            }}
          />
        )}
      </div>

      <div className="grid grid-cols-4 gap-1">
        {galleryImages.map((image) => (
          <div
            className="flex justify-center items-center rounded-lg h-[10rem] bg-gray-700 overflow-hidden cursor-pointer"
            key={image}
          >
            <img
              src={image}
              alt=""
              className="object-cover w-full h-full"
              onClick={() => handlePrimaryImage(image)}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProductGallery;
