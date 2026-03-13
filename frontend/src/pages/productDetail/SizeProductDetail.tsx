type Size = "S" | "M" | "L" | "XL" | "XXL";

interface SizeProductDetailProps {
  size:Size
  handleSize: (value: Size) => void;
}

const SIZES: Size[] = ["S", "M", "L", "XL", "XXL"];

const SizeProductDetail = ({ size, handleSize }: SizeProductDetailProps) => {
   
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
        {SIZES.map((valueSize) => (
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
