import React from "react";
import InputField from "./InputField";

const AddProductForm: React.FC = () => {
  return (
    <div className="w-full p-4 bg-white border shadow-sm border-slate-100 rounded-xl">
      <form onSubmit={(e) => e.preventDefault()} className="max-w-full">
        {/* Row 1: Product Name & SKU */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
          <InputField label="Product Name" placeholder="Enter product name" />
          <InputField label="SKU" placeholder="Enter SKU" />
        </div>

        {/* Row 2: Price & Stock Quantity */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
          <InputField label="Price" placeholder="0.00" type="number" />
          <InputField label="Stock Quantity" placeholder="0" type="number" />
        </div>

        {/* Category Select */}
        <InputField label="Category" placeholder="Select category" isSelect />

        {/* Product Image - Custom File Input */}
        <div className="flex flex-col mb-5">
          <label className="text-[14px] font-semibold text-slate-700">
            Product Image
          </label>
          <div className="mt-1.5 flex items-center border border-slate-200 rounded-lg overflow-hidden">
            <label className="bg-slate-100 px-5 py-3 text-[14px] font-medium text-dashboardTextPrimary border-r border-slate-200 cursor-pointer hover:bg-slate-200 transition-colors">
              Choose File
              <input type="file" className="hidden" />
            </label>
            <span className="px-4 text-[14px] text-slate-400">
              No file chosen
            </span>
          </div>
        </div>

        {/* Description */}
        <InputField
          label="Description"
          placeholder="Enter product description"
          isTextArea
        />

        {/* Form Actions (Buttons) */}
        <div className="flex items-center gap-3 mt-6">
          <button
            type="button"
            className="bg-dashboardPrimary hover:bg-dashboardPrimary text-white px-8 py-3 rounded-lg text-[15px] font-light transition-all shadow-sm active:scale-95"
          >
            Add Product
          </button>
          <button
            type="button"
            className="bg-dashboardTextPrimary hover:bg-slate-800 text-white px-8 py-3 rounded-lg text-[15px] font-semibold transition-all shadow-sm active:scale-95"
          >
            Clear
          </button>
        </div>
      </form>
    </div>
  );
};

export default AddProductForm;
