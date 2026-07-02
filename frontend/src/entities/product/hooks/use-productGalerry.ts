import { useEffect, useRef, useState } from "react";
import type { ProductResponse } from "../model/product.types";
import type { MouseEvent } from "react";

const IMAGE_URLS = [
  "https://d2kchovjbwl1tk.cloudfront.net/vendor/9549/product/1_1766377064172_resized1024-jpg.webp",
  "https://d2kchovjbwl1tk.cloudfront.net/vendor/9549/product/2_1766377064220_resized256-jpg.webp",
  "https://d2kchovjbwl1tk.cloudfront.net/vendor/9549/product/4_1766377064263_resized256-jpg.webp",
];

const INITIAL_IMAGE = IMAGE_URLS[0];

interface ProductGalleryProps {
  product: ProductResponse;
}

type ZoomPosition = {
  x: number;
  y: number;
};

export function useProductGalerry({ product }: ProductGalleryProps) {
  const imageUrls = product.images.map((image) => image.url);
  const galleryImages = imageUrls.length > 0 ? imageUrls : IMAGE_URLS;
  const [showZoom, setShowZoom] = useState(false);
  const [zoomPosition, setZoomPosition] = useState<ZoomPosition>({
    x: 0,
    y: 0,
  });
  const [primaryImage, setPrimaryImage] = useState<string>(
    galleryImages[0] ?? INITIAL_IMAGE,
  );

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

  return {
    imageRef,
    handleMouseEnter,
    handleMouseLeave,
    handleMouseMove,
    primaryImage,
    showZoom,
    zoomPosition,
    galleryImages,
    handlePrimaryImage,
  };
}
