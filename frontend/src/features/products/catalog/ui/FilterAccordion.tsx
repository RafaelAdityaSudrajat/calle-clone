import { useState } from "react";
import { FaChevronUp } from "react-icons/fa";

import type { FilterOption } from "../model/types";

interface FilterAccordionProps {
  label: string;
  options: FilterOption[];
  selectedValue: string;
  onChange: (value: string) => void;
}

const FilterAccordion = ({
  label,
  options,
  selectedValue,
  onChange,
}: FilterAccordionProps) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="py-2 border-b border-zinc-200">
      <div className="px-4">
        <button
          type="button"
          className="flex items-center justify-between w-full py-2"
          onClick={() => setIsOpen((previous) => !previous)}
        >
          <span className="text-[.9rem] text-primary">{label}</span>
          <FaChevronUp
            className={`w-3 h-3 transition-transform duration-300 ${
              isOpen ? "rotate-0" : "rotate-180"
            }`}
          />
        </button>

        <div
          className={[
            "overflow-hidden transition-all duration-300 ease-in-out",
            isOpen ? "opacity-100 translate-y-0 max-h-48" : "max-h-0 opacity-0",
          ].join(" ")}
        >
          <div className="mt-2 space-y-2">
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                className="flex items-center gap-2 text-[12px] font-medium text-primary"
                onClick={() => onChange(option.value)}
              >
                <span className="grid w-4 h-4 border rounded-full place-items-center border-zinc-400">
                  {selectedValue === option.value && (
                    <span className="w-2 h-2 rounded-full bg-zinc-900" />
                  )}
                </span>
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FilterAccordion;

