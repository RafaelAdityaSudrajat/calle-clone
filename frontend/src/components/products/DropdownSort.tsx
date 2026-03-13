import { useEffect, useState } from "react";
import { FaChevronUp } from "react-icons/fa";
import UseTrigger from "../../hooks/CustomHookShare";

const DropdownSort = () => {
  const { trigger, handleTrigger } = UseTrigger();

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
    <div className="absolute top-0 right-0">
      <div className="px-4 text-[1rem]">
        <button
          type="button"
          className="flex items-center justify-between w-full gap-4 px-4 border-2 rounded-md border-zinc-200"
          onClick={toggle}
       
        >
          <span className="text-[1rem] text-primary">Sort</span>

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
              <label
                className="flex items-center gap-2 font-medium cursor-pointer text-primary"
               
              >
                testtt
              </label>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DropdownSort;
