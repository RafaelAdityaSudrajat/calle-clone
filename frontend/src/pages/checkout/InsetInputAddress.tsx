import { useState } from "react";

interface InsetInputAddressProps {
  value?: string;
  placeholder?: string;
  type?: string;
}

const InsetInputAdress = ({
  value = "",
  placeholder = "",
  type = "text",
}: InsetInputAddressProps) => {
  const [text, setText] = useState("");
  const maxCharacter = 250;

  return (
    <div className="w-full">
      {/* 1. BINGKAI UTAMA (Membungkus Label & Textarea) */}
      <div
        className="flex flex-col w-full p-5 transition-all bg-white border shadow-sm border-slate-200 rounded-2xl focus-within:border-slate-400 focus-within:ring-1 focus-within:ring-slate-400"
      >


        {/* Input Textarea Murni */}
        <textarea
          onChange={(e) => setText(e.target.value.slice(0, maxCharacter))}
          placeholder= {placeholder}
          value={text}
          /* ========================================================
             👉 AJDUST TINGGI LEWAT JUMLAH BARIS (ROWS):
             Kamu juga bisa atur tinggi lewat properti 'rows' bawaan ini.
             ======================================================== */
          rows={4}
          className="
            w-full 
            flex-1 
            bg-transparent 
            border-none 
            p-0 
            mt-0.5
            text-[15px] font-medium text-slate-800 
            placeholder:text-slate-400 
            focus:outline-none 
            focus:ring-0 
            resize-none 
          "
        />
      </div>

      {/* 2. CHARACTER COUNTER (Di luar kanan bawah kotak) */}
      <div className="flex justify-end mt-1.5 px-1">
        <span className="text-[13px] font-black text-slate-800 tracking-wide">
          {text.length} / {maxCharacter}
        </span>
      </div>
    </div>
  );
};

export default InsetInputAdress;
