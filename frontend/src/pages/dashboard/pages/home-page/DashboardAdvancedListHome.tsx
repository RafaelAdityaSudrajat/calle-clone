import React from 'react';
import { HiOutlineDuplicate } from 'react-icons/hi';
import {  HiOutlineCreditCard, HiOutlineBanknotes } from 'react-icons/hi2';
import type AdvancedStatItem from '../../type/type-advanced-list-home';
import ProfitCard from './ProfitCard';

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