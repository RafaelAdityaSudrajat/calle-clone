import { useEffect, useState } from "react";
import { FaChevronUp } from "react-icons/fa";

interface Trigger {
  trigger: boolean;
}

const DropDownMenu = ({ trigger }: Trigger) => {
  const [productType, setProductType] = useState<string>("all");

  // dropdown Product Type
  const [mounted, setMounted] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const open = () => {
    setMounted(true);
    requestAnimationFrame(() => setExpanded(true)); // penting biar enter anim jalan
  };

  const close = () => {
    setExpanded(false);
    window.setTimeout(() => setMounted(false), 300);
  };

  const toggle = () => {
    if (expanded) close();
    else open();
  };

  // kalau modal/filter ditutup, dropdown ikut reset biar aman
  useEffect(() => {
    if (!trigger) {
      setExpanded(false);
      setMounted(false);
    }
  }, [trigger]);

  return (
    <div className="pb-4 border-b border-zinc-200">
      <button
        type="button"
        className="flex items-center justify-between w-full py-2"
        onClick={toggle} 
      >
        <span className="text-xs text-primary">Product Type</span>

        {/* rotate icon biar makin kerasa */}
        <FaChevronUp
          className={`w-3 h-3 transition-transform duration-300 ${
            expanded ? "rotate-0" : "rotate-180"
          }`}
        />
      </button>

      {mounted && (
        <div
          className={[
            "overflow-hidden",
            "transition-all duration-300 ease-in-out",
            expanded
              ? "opacity-100 translate-y-0 max-h-40"
              : "opacity-0 -translate-y-2 max-h-0",
          ].join(" ")}
          style={{ transitionDuration: `${300}ms` }}
        >
          <div className="mt-2 space-y-2">
            <label
              className="flex cursor-pointer items-center gap-2 text-[12px] font-medium text-primary"
              onClick={() => setProductType("all")}
            >
              <span className="grid w-4 h-4 border rounded-full place-items-center border-zinc-400">
                {productType === "all" && (
                  <span className="w-2 h-2 rounded-full bg-zinc-900" />
                )}
              </span>
              All Products
            </label>

            <label
              className="flex cursor-pointer items-center gap-2 text-[12px] font-medium text-primary"
              onClick={() => setProductType("featured")}
            >
              <span className="grid w-4 h-4 border rounded-full place-items-center border-zinc-400">
                {productType === "featured" && (
                  <span className="w-2 h-2 rounded-full bg-zinc-900" />
                )}
              </span>
              Featured Products
            </label>
          </div>
        </div>
      )}
    </div>
  );
};

export default DropDownMenu;
