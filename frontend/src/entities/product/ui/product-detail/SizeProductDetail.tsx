import type { ProductSize } from "@/entities/product";

interface SizeProductDetailProps {
  size: ProductSize | "";
  sizes: ProductSize[];
  handleSize: (value: ProductSize) => void;
}

const SizeProductDetail = ({
  size,
  sizes,
  handleSize,
}: SizeProductDetailProps) => {
  const base: string = "py-3 text-sm font-medium rounded-md";

  const variants = {
    default: "border",
    active: "bg-black text-white",
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="font-medium">Size</p>
        <button className="text-sm underline">Size Guide</button>
      </div>

      <div className="grid grid-cols-6 gap-3">
        {sizes.map((valueSize) => (
          <button
            key={valueSize}
            className={`${base} ${valueSize === size ? variants.active : variants.default}`}
            onClick={() => handleSize(valueSize)}
          >
            {valueSize}
          </button>
        ))}
      </div>
    </div>
  );
};

export default SizeProductDetail;
