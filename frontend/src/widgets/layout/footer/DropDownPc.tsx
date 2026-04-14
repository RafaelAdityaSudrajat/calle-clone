import dataDropDown from "@/shared/config/dataDropDown";

const DropDownPc = () => {
  return (
    <section className="py-10 bg-zinc-900">
      <div className="flex flex-col gap-[2rem]">
        <div className="max-w-5xl mx-auto">
          {/* Title */}
          <h3 className="mb-8 text-sm font-semibold tracking-wide text-center text-white">
            Payment Method
          </h3>

          {/* Payment Icons */}
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-5">
            {/* Baris 1 */}
            {dataDropDown.map((data, i) => (
              <div className="text-white" key={i}>
                {data}
              </div>
            ))}
          </div>
        </div>

        <div className="max-w-5xl mx-auto">
          {/* Title */}
          <h3 className="mb-8 text-sm font-semibold tracking-wide text-center text-white">
            Shipment Method
          </h3>

          {/* Payment Icons */}
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-5">
            {/* Baris 1 */}
            {dataDropDown.map((data, i) => (
              <div className="text-white" key={i}>
                {data}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default DropDownPc;
