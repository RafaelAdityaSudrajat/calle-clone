interface InsetInputProps {
  value?: string;
  placeholder?: string;
  type?: string;
}

const InsetInput = ({
  value = "",
  placeholder = "",
  type = "text",
}: InsetInputProps) => {
  return (
    <div className="w-full border border-slate-200 rounded-xl px-4 py-2.5 bg-white shadow-sm focus-within:border-slate-400 focus-within:ring-1 focus-within:ring-slate-400 transition-all">
      <input
        type={type}
        defaultValue={value}
        placeholder={placeholder}
        className="w-full bg-transparent border-none p-0 mt-0.5 text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-0"
      />
    </div>
  );
};

export default InsetInput;
