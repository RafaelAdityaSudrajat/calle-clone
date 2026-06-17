import React from "react";

// Definisi interface untuk menjaga tipe data yang ketat (Senior Practice)
interface PageHeaderProps {
  title?: string;
  subtitle?: string;
  buttonText?: string;
}

const HeaderAdminProduct: React.FC<PageHeaderProps> = ({
  title = "Add Inventory",
  subtitle = "Manage your inventory items",
  buttonText = "Go to Inventory List",
}) => {
  return (
    <div className="flex flex-col justify-between gap-4 py-2 mb-6 font-sans md:flex-row md:items-center">
      {/* Bagian Kiri: Judul dan Deskripsi */}
      <div className="flex flex-col">
        <h1 className="text-xl font-light tracking-tight text-dashboardTextPrimary">
          {title}
        </h1>
        <p className="text-[15px] text-slate-500 mt-1">{subtitle}</p>
      </div>

      {/* Bagian Kanan: Aksi (Tombol) */}
      <div className="flex items-center">
        <button
          type="button"
          className="
            bg-dashboardPrimary          
            hover:bg-[#d15a3a]     
            text-white            
            px-6 py-2.5            
            rounded-lg              
            text-[14px] font-medium 
            transition-all          
            shadow-sm               
            active:scale-95
          "
        >
          {buttonText}
        </button>
      </div>
    </div>
  );
};

export default HeaderAdminProduct;
