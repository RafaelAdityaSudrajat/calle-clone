// src/components/StatCard.tsx
export default function StatCard({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <div className="p-5 bg-white shadow-sm rounded-2xl">
      <div className="flex items-center justify-center h-16 mb-4 text-sm rounded-lg bg-slate-100 text-slate-400">
        Chart
      </div>
      <p className="text-xl font-semibold">{value}</p>
      <span className="text-sm text-slate-400">{title}</span>
    </div>
  );
}
