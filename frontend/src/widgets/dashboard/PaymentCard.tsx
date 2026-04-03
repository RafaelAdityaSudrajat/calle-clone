type PaymentStatus = "Paid" | "Pending" | "Failed";

interface PaymentCardProps {
  name: string;
  company: string;
  status: PaymentStatus;
  amount: string;
  avatarUrl?: string;
}

export default function PaymentCard({
  name,
  company,
  status,
  amount,
  avatarUrl,
}: PaymentCardProps) {
  const statusStyle: Record<PaymentStatus, string> = {
    Paid: "bg-green-100 text-green-600",
    Pending: "bg-orange-100 text-orange-600",
    Failed: "bg-red-100 text-red-600",
  };

  return (
    <div className="flex items-center justify-between px-4 py-3 bg-white border-b shadow-sm rounded-xl">
      {/* Left */}
      <div className="flex items-center flex-1 gap-3">
        <img
          src={avatarUrl ?? "https://i.pravatar.cc/40"}
          alt={name}
          className="object-cover w-10 h-10 rounded-full"
        />

        <div className="leading-tight">
          <p className="text-sm font-semibold text-slate-800">{name}</p>
          <span className="text-xs text-slate-400">{company}</span>
        </div>
      </div>

      {/* Status */}
      <div className="flex items-center justify-around flex-1">
        <span
          className={`text-xs font-medium px-3 py-1 rounded-full ${statusStyle[status]}`}
        >
          {status}
        </span>

        {/* Amount */}
        <p className="text-sm font-semibold text-slate-800">{amount}</p>
      </div>
    </div>
  );
}
