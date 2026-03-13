import type { MouseEvent } from "react";
import { useRef, useState } from "react";

const IMAGE_URLS = [
  "https://d2kchovjbwl1tk.cloudfront.net/vendor/9549/product/1_1766377064172_resized1024-jpg.webp",
  "https://d2kchovjbwl1tk.cloudfront.net/vendor/9549/product/2_1766377064220_resized256-jpg.webp",
  "https://d2kchovjbwl1tk.cloudfront.net/vendor/9549/product/4_1766377064263_resized256-jpg.webp",
];

const INITIAL_IMAGE = IMAGE_URLS[0];

type ZoomPosition = {
  x: number;
  y: number;
};

const ProductGallery = () => {
  const [showZoom, setShowZoom] = useState(false);
  const [zoomPosition, setZoomPosition] = useState<ZoomPosition>({
    x: 0,
    y: 0,
  });
  const [primaryImage, setPrimaryImage] = useState<string>(INITIAL_IMAGE);

  const imageRef = useRef<HTMLDivElement | null>(null);

  const handlePrimaryImage = (value: string) => {
    setPrimaryImage(value);
  };

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!imageRef.current) return;

    const rect = imageRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    setZoomPosition({ x, y });
  };

  const handleMouseEnter = () => {
    setShowZoom(true);
  };

  const handleMouseLeave = () => {
    setShowZoom(false);
  };

  return (
    <div className="flex flex-col w-full gap-2">
      <div
        ref={imageRef}
        className="aspect-[1/1] min-h-[20rem] bg-gray-100 rounded-lg flex items-center justify-center lg:max-h-[29rem] relative overflow-hidden cursor-crosshair"
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
              backgroundSize: "200%",
              backgroundPosition: `${zoomPosition.x}% ${zoomPosition.y}%`,
              backgroundRepeat: "no-repeat",
            }}
          />
        )}
      </div>

      <div className="grid grid-cols-4 gap-1">
        {IMAGE_URLS.map((image) => (
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
