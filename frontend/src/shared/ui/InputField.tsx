import type InputFieldProps from "@/shared/types/type-input-field"
import React from "react"

const InputField: React.FC<InputFieldProps> = (props) => {
  const baseClasses = "w-full mt-1.5 px-4 py-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-dashboardPrimary focus:ring-1 focus:ring-dashboardPrimary transition-all bg-white text-dashboardTextPrimary placeholder:text-slate-400 font-light"

  if (props.isTextArea) {
    const { label, placeholder, isTextArea, isSelect, ...rest } = props
    return (
      <div className="flex flex-col w-full mb-5">
        <label className="text-[14px] font-light text-dashboardTextPrimary">{label}</label>
        <textarea placeholder={placeholder} rows={4} className={baseClasses} {...rest} />
      </div>
    )
  }

  if (props.isSelect) {
    const { label, placeholder, isTextArea, isSelect, children, ...rest } = props
    return (
      <div className="flex flex-col w-full mb-5">
        <label className="text-[14px] font-light text-dashboardTextPrimary">{label}</label>
        <select
          className={`${baseClasses} appearance-none cursor-pointer bg-[url('https://cdn-icons-png.flaticon.com/512/60/60995.png')] bg-[length:12px] bg-[right_1rem_center] bg-no-repeat`}
          {...rest}
        >
          <option value="">{placeholder}</option>
          {children}
        </select>
      </div>
    )
  }

  const { label, placeholder, isTextArea, isSelect, ...rest } = props
  return (
    <div className="flex flex-col w-full mb-5">
      <label className="text-[14px] font-light text-dashboardTextPrimary">{label}</label>
      <input placeholder={placeholder} className={baseClasses} {...rest} />
    </div>
  )
}

export default InputField