// CountryDropdown.tsx
import { useState } from 'react';
import { HiChevronDown } from 'react-icons/hi2';
import { countries } from './data/countries';

const CountryDropdown = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState('Indonesia');
 

  return (
    <div className="relative w-full font-sans">
      
      {/* 1. TOMBOL UTAMA (TRIGGER DROPDOWN) */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="
          w-full 
          border border-slate-200 
          rounded-xl 
          px-4 py-2.5 
          bg-white 
          shadow-sm 
          flex items-center justify-between 
          text-left 
          focus:outline-none 
          focus:border-slate-400 
          focus:ring-1 focus:ring-slate-400 
          transition-all
        "
      >
        <div>
          {/* Label atas */}
          <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wide select-none">
            Country
          </span>
          {/* Nilai negara yang terpilih */}
          <span className="block text-sm font-bold text-[#0f172a] mt-0.5">
            {selectedCountry}
          </span>
        </div>

        {/* Ikon Chevron dengan animasi rotasi halus saat dropdown terbuka */}
        <HiChevronDown 
          className={`text-sm text-slate-800 transition-transform duration-200 font-bold ${
            isOpen ? 'rotate-180' : ''
          }`} 
        />
      </button>

      {/* 2. FLOATING MENU LIST */}
      {isOpen && (
        <>
          {/* Overlay transparan di latar belakang untuk menutup dropdown jika user klik di luar area */}
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          
          {/* Kotak Pilihan Negara */}
          <ul 
            className="
              absolute left-0 right-0 
              mt-2 
              bg-white 
              border border-slate-200 
              rounded-xl 
              shadow-xl 
              z-50 
              max-h-60 
              overflow-y-auto 
              py-1.5
            "
          >
            {countries.map((country) => (
              <li key={country}>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCountry(country);
                    setIsOpen(false);
                  }}
                  className={`
                    w-full text-left 
                    px-4 py-3 
                    text-[15px] font-semibold 
                    transition-colors
                    ${selectedCountry === country 
                      ? 'bg-slate-50 text-slate-900 font-extrabold' 
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }
                  `}
                >
                  {country}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

    </div>
  );
};

export default CountryDropdown;