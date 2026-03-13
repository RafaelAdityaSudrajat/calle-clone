import { useEffect, useState } from "react";
import { FaChevronUp } from "react-icons/fa";

interface DropDownMenuProps {
  trigger: boolean;
  label: string;
  value: string[];
}

const DropDownMenu = ({ trigger, label, value }: DropDownMenuProps) => {
  const [productType, setProductType] = useState(null);

  // dropdown Product Type
  const [mounted, setMounted] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const open = () => {
    setMounted(true);
    requestAnimationFrame(() => setExpanded(true));
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
    <div className="py-2 border-b border-zinc-200">
      <div className="px-4">
        <button
          type="button"
          className="flex items-center justify-between w-full py-2"
          onClick={toggle}
        >
          <span className="text-[.9rem] text-primary">{label}</span>

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
                : "opacity-0 -translate-y-4 max-h-0",
            ].join(" ")}
            style={{ transitionDuration: `${300}ms` }}
          >
            <div className="mt-2 space-y-2">
              {value.map((item, i) => (
                <label
                  className="flex cursor-pointer items-center gap-2 text-[12px] font-medium text-primary"
                  onClick={() => setProductType(i)}
                  key={i}
                >
                  <span className="grid w-4 h-4 border rounded-full place-items-center border-zinc-400">
                    {productType == i && (
                      <span className="w-2 h-2 rounded-full bg-zinc-900" />
                    )}
                  </span>
                  {item}
                </label>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DropDownMenu;
