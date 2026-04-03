import BackDrop from "../../shared/ui/BackDrop";
import Filter from "./Filter";
import Sort from "./Sort";

interface FilterAndSortPopUpProps {
  trigger: boolean;
  handleTrigger: () => void;
  activeSheet: string | null;
}

const FilterAndSortPopUp = ({
  trigger,
  handleTrigger,
  activeSheet,
}: FilterAndSortPopUpProps) => {
  return (
    <BackDrop trigger={trigger} onClose={handleTrigger}>
      <div
        className={`absolute bottom-0 md:bottom-[50%] md:translate-y-[50%] right-1/2 translate-x-1/2 w-[95%] max-w-[30rem]
           bg-white border rounded-t-3xl md:rounded-3xl border-zinc-200
            h-auto max-h-[90vh] overflow-y-scroll scrollbar-hide
             transform transition-transform duration-500 ease-out
         ${trigger ? "translate-y-0" : "translate-y-full"}
  `}
        onClick={(e) => e.stopPropagation()}
      >
        {activeSheet === "filter" && <Filter trigger={trigger} />}
        {activeSheet === "sort" && <Sort />}
      </div>
    </BackDrop>
  );
};

export default FilterAndSortPopUp;
