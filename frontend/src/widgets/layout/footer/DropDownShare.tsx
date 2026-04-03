import { useState } from "react";
import { RiArrowDropDownLine } from "react-icons/ri";
import dataDropDown from "@/shared/config/dataDropDown";

const DropDownShare = () => {
  const [triggerDropDown, setTriggerDropDOwn] = useState(false);

  function handleTriggerDropDown() {
    setTriggerDropDOwn((prev) => !prev);
  }

  return (
    <div className="border-b border-white px-padding_primary bg-secondary text-[.9rem]">
      <div className="flex items-center justify-between py-4 text-white ">
        <div className="">Payment Method</div>

        <div className="" onClick={handleTriggerDropDown}>
          <RiArrowDropDownLine className="w-6 h-6" />
        </div>
      </div>

      <div
        className={`${
          triggerDropDown ? "flex" : "hidden"
        } flex-wrap gap-2  text-white`}
      >
        {dataDropDown.map((data, i) => (
          <div className="" key={i}>
            {data}
          </div>
        ))}
      </div>
    </div>
  );
};

export default DropDownShare;
