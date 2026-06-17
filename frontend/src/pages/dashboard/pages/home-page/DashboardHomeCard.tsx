// SalesCard.tsx
import React from "react";
import { HiOutlineClipboardList } from "react-icons/hi";
import type { CardData } from "../../type/type-card-data";

// Definisi properti komponen (meskipun kita tidak menggunakannya untuk data, ini adalah praktik terbaik TS untuk komponen yang dapat digunakan kembali)
interface DashboardHomeCardProps {
  className?: string; // Untuk menambahkan class kustom dari luar jika perlu
  cardData: CardData;
}

const DashboardHomeCard: React.FC<DashboardHomeCardProps> = ({
  className = "",
  cardData,
}) => {
  return (
    <div
      className={`
        bg-red-50              /* Latar belakang merah muda sangat muda */
        border border-red-300  /* Batas tipis merah muda muda */
        rounded-3xl            /* Sudut yang sangat membulat */
        shadow-md              /* Bayangan tipis untuk kedalaman */
        p-7                    /* Padding internal yang cukup luas */
        w-full /* Lebar maksimal kartu */
        font-sans              /* Menggunakan font sans-serif */
        ${className}
      `}
    >
      <div className="flex items-center gap-6">
        {/* Kontainer Ikon Oranye Kemerahan */}
        <div
          className="
            bg-orange-600        /* Warna latar oranye karat */
            rounded-2xl          /* Sudut membulat pada kotak ikon */
            p-5                  /* Padding internal di dalam kotak ikon */
            flex items-center    /* Pusatkan ikon secara vertikal */
            justify-center       /* Pusatkan ikon secara horizontal */
            shrink-0             /* Mencegah kotak ikon menyusut */
           /* Ukuran kotak ikon yang besar */
          "
        >
          {/* Ikon Papan Klip dengan daftar, paling dekat dengan desain */}
          <HiOutlineClipboardList
            className="
              text-white         /* Ikon berwarna putih */
                 /* Ukuran ikon yang besar */
            "
          />
        </div>

        {/* Kontainer Teks di Kanan */}
        <div className="flex flex-col gap-1.5 flex-1">
          {/* Teks Judul */}
          <p
            className="
              text-gray-800      /* Teks berwarna abu-abu gelap */
                 /* Ukuran teks judul yang cukup besar */
              font-medium        /* Berat font medium */
            "
          >
            {cardData.title}
          </p>

          {/* Teks Nilai Utama */}
          <div
            className="
              text-gray-950      /* Teks berwarna hampir hitam */
                /* Ukuran teks nilai yang sangat besar untuk penekanan */
              font-bold          /* Berat font tebal (bold) */
              tracking-tight     /* Spasi antar huruf yang rapat untuk estetika */
            "
          >
            {cardData.value}
          </div>

          {/* Teks Detail di Bawah */}
          <p
            className="
              text-orange-600    /* Teks berwarna oranye karat yang serasi */
              text-base          /* Ukuran teks detail standard */
              font-medium        /* Berat font medium */
            "
          >
            {cardData.detail}
          </p>
        </div>
      </div>
    </div>
  );
};

export default DashboardHomeCard;
