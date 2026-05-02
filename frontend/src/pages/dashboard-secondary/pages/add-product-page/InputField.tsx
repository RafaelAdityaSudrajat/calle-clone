import type InputFieldProps from '../../type/type-input-field';

// Reusable Input Component untuk efisiensi kode


const InputField: React.FC<InputFieldProps> = ({ 
  label, 
  placeholder, 
  type = "text", 
  isTextArea = false,
  isSelect = false 
}) => {
  const baseClasses = "w-full mt-1.5 px-4 py-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-dashboardPrimary focus:ring-1 focus:ring-dashboardPrimary transition-all bg-white text-dashboardTextPrimary placeholder:text-slate-400 font-light";

  return (
    <div className="flex flex-col w-full mb-5">
      <label className="text-[14px] font-light text-dashboardTextPrimary">{label}</label>
      {isTextArea ? (
        <textarea placeholder={placeholder} rows={4} className={baseClasses} />
      ) : isSelect ? (
        <select className={`${baseClasses} appearance-none cursor-pointer bg-[url('https://cdn-icons-png.flaticon.com/512/60/60995.png')] bg-[length:12px] bg-[right_1rem_center] bg-no-repeat`}>
          <option value="">{placeholder}</option>
        </select>
      ) : (
        <input type={type} placeholder={placeholder} className={baseClasses} />
      )}
    </div>
  );
};

export default InputField