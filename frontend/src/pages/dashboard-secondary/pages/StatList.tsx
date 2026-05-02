import React from 'react';
import { 
  HiOutlineClipboardDocumentList, 
  HiOutlineArrowsRightLeft, 
  HiOutlineCurrencyDollar, 
  HiOutlineDocumentText 
} from 'react-icons/hi2';
import type StatItem from '../type/type-stat-item';
import StatCard from './StatCard';



// 3. Main Component: StatList
const StatList: React.FC = () => {
  // Data di-hardcode sesuai permintaan (tanpa state)
  const stats: StatItem[] = [
    {
      title: 'Total Sales',
      value: '$25,000',
      trend: '+5% since last month',
      icon: HiOutlineClipboardDocumentList,
      colors: {
        bg: 'bg-[#fff5f2]',
        border: 'border-[#ffe4dc]',
        iconBg: 'bg-[#e96b46]',
        text: 'text-[#e96b46]'
      }
    },
    {
      title: 'Total Purchase',
      value: '$18,000',
      trend: '+22% since last month',
      icon: HiOutlineArrowsRightLeft,
      colors: {
        bg: 'bg-[#f0fdf4]',
        border: 'border-[#dcfce7]',
        iconBg: 'bg-[#10b981]',
        text: 'text-[#10b981]'
      }
    },
    {
      title: 'Total Expenses',
      value: '$9,000',
      trend: '+10% since last month',
      icon: HiOutlineCurrencyDollar,
      colors: {
        bg: 'bg-[#ecfeff]',
        border: 'border-[#cffafe]',
        iconBg: 'bg-[#06b6d4]',
        text: 'text-[#06b6d4]'
      }
    },
    {
      title: 'Invoice Due',
      value: '$25,000',
      trend: '+35% since last month',
      icon: HiOutlineDocumentText,
      colors: {
        bg: 'bg-[#fffbeb]',
        border: 'border-[#fef3c7]',
        iconBg: 'bg-[#f59e0b]',
        text: 'text-[#f59e0b]'
      }
    }
  ];

  return (
    <section className="w-full mb-6">
      {/* Grid System: 1 kolom di mobile, 2 di tablet, 4 di desktop */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, index) => (
          <StatCard key={index} item={stat} />
        ))}
      </div>
    </section>
  );
};

export default StatList;