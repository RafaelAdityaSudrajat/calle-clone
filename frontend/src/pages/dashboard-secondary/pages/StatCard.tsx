// 1. Definisi Type untuk konsistensi Data

import type StatItem from "../type/type-stat-item";


const StatCard: React.FC<{ item: StatItem }> = ({ item }) => {
  const { title, value, trend, icon: Icon, colors } = item;

  return (
    <div
      className={`
      ${colors.bg} ${colors.border} 
      border rounded-[20px] px-6 py-3 flex items-center gap-5 
      transition-all duration-300 hover:shadow-lg cursor-default
    `}
    >
      {/* Icon Container */}
      <div className={`${colors.iconBg} p-3.5 rounded-xl shrink-0 shadow-sm`}>
        <Icon className="text-2xl text-white" />
      </div>

      {/* Content */}
      <div className="flex flex-col">
        <span className="mb-1 text-sm font-light text-slate-700">{title}</span>
        <span className="text-slate-900 text-xl font-light tracking-tight mb-0.5">
          {value}
        </span>
        <span className={`${colors.text} text-xs font-light`}>{trend}</span>
      </div>
    </div>
  );
};

export default StatCard;
