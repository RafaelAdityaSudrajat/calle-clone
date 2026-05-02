import type AdvancedStatItem from "../../type/type-advanced-list-home";

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
          {trend}{" "}
          <span className="ml-1 text-xs font-medium text-slate-400">
            vs Last Month
          </span>
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

export default ProfitCard;
