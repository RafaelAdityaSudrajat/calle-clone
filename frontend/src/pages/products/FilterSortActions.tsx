import { IoFilterSharp } from "react-icons/io5";
import { FaSortAmountDown } from "react-icons/fa";


interface FilterSortActionsProps {
    handleTrigger: () => void
    handleActiveeSheet: (type: "filter" | "sort") => void
}

const FilterSortActions = ({handleTrigger, handleActiveeSheet} : FilterSortActionsProps) => {
  return (
    <div className="flex w-full gap-3 my-4 px-padding_primary lg:hidden">
      <button
        className="flex items-center justify-center flex-1 gap-2 px-6 py-2 border rounded-xl border-primary"
        onClick={() => handleActiveeSheet("filter")}
      >
        <IoFilterSharp />
        <p onClick={handleTrigger}>Filter</p>
      </button>
      <button
        className="flex items-center justify-center flex-1 gap-2 px-6 py-2 border rounded-xl border-primary"
        onClick={() => handleActiveeSheet("sort")}
      >
        <FaSortAmountDown />
        <p onClick={handleTrigger}>Sort</p>
      </button>
    </div>
  );
};

export default FilterSortActions;
