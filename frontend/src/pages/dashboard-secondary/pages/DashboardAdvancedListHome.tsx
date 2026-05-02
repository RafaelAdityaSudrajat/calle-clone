import React from 'react';
import { HiOutlineDuplicate } from 'react-icons/hi';
import {  HiOutlineCreditCard, HiOutlineBanknotes } from 'react-icons/hi2';

// 1. Definisi Type untuk Data Kartu
interface AdvancedStatItem {
  value: string;
  label: string;
  trend: string;
  trendColor: string; // Tailwind class untuk warna teks trend
  icon: React.ElementType;
  iconColor: string;  // Tailwind class untuk warna ikon
}

// 2. Komponen Reusable Card
const ProfitCard: React.FC<{ item: AdvancedStatItem }> = ({ item }) => {
  const { value, label, trend, trendColor, icon: Icon, iconColor } = item;

  return (
    <div className="flex flex-col justify-between p-6 transition-shadow duration-200 bg-white border shadow-sm border-slate-200 rounded-xl hover:shadow-md">
      {/* Bagian Atas: Value, Label, dan Ikon */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-[26px] font-bold text-slate-900 tracking-tight leading-none">
            {value}
          </h2>
          <span className="text-slate-500 text-[15px] font-medium">
            {label}
          </span>
        </div>
        {/* Ikon dengan warna spesifik */}
        <Icon className={`text-3xl ${iconColor}`} />
      </div>

      {/* Divider / Garis Pemisah */}
      <div className="w-full mb-4 border-t border-slate-100"></div>

      {/* Bagian Bawah: Trend dan Link Action */}
      <div className="flex items-center justify-between">
        <span className={`text-[13px] font-bold ${trendColor}`}>
          {trend} <span className="ml-1 text-xs font-medium text-slate-400">vs Last Month</span>
        </span>
        <a 
          href="#" 
          className="text-orange-600 text-[13px] font-semibold hover:underline transition-all"
          onClick={(e) => e.preventDefault()}
        >
          View
        </a>
      </div>
    </div>
  );
};

// 3. Main List Component
const DashboardAdvancedListHome: React.FC = () => {
  const data: AdvancedStatItem[] = [
    {
      value: '$25,458',
      label: 'Total Profit',
      trend: '+35%',
      trendColor: 'text-emerald-500',
      icon: HiOutlineDuplicate,
      iconColor: 'text-orange-500', // Sesuai warna oranye di gambar
    },
    {
      value: '$45,458',
      label: 'Total Payment Returns',
      trend: '-20%',
      trendColor: 'text-rose-500',
      icon: HiOutlineCreditCard,
      iconColor: 'text-rose-500', // Sesuai warna pink/merah di gambar
    },
    {
      value: '$34,458',
      label: 'Total Expenses',
      trend: '-20%',
      trendColor: 'text-amber-500',
      icon: HiOutlineBanknotes,
      iconColor: 'text-amber-500', // Sesuai warna kuning/emas di gambar
    }
  ];

  return (
    <div className="min-h-fit">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {data.map((item, index) => (
          <ProfitCard key={index} item={item} />
        ))}
      </div>
    </div>
  );
};

export default DashboardAdvancedListHome;