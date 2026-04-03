// src/components/PaymentRow.tsx
export default function PaymentRow({
  name,
  status,
  amount,
}: {
  name: string;
  status: "Paid" | "Pending" | "Failed";
  amount: string;
}) {
  const statusColor = {
    Paid: "bg-green-100 text-green-600",
    Pending: "bg-orange-100 text-orange-600",
    Failed: "bg-red-100 text-red-600",
  }[status];

  return (
    <div className="flex items-center justify-between py-3 border-b last:border-none">
      <div className="flex items-center gap-3">
        <img
          src="https://i.pravatar.cc/32"
          className="w-8 h-8 rounded-full"
        />
        <div>
          <p className="text-sm font-medium">{name}</p>
          <span className="text-xs text-slate-400">Company, Inc</span>
        </div>
      </div>

      <span className={`text-xs px-3 py-1 rounded-full ${statusColor}`}>
        {status}
      </span>

      <p className="text-sm font-semibold">{amount}</p>
    </div>
  );
}
