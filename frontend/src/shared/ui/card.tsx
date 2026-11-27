import { useId, type ReactNode } from "react";
import { cn } from "@/shared/lib/cn";

interface CardProps {
  title: string;
  description?: string;
  tone?: "default" | "danger";
  children: ReactNode;
}

export const Card = ({ title, description, tone = "default", children }: CardProps) => {
  const headingId = useId();
  const danger = tone === "danger";

  return (
    <section
      aria-labelledby={headingId}
      className={cn(
        "rounded-xl border bg-white shadow-sm",
        danger ? "border-red-200" : "border-gray-200",
      )}
    >
      <header className="px-5 py-4 border-b border-gray-100">
        <h2
          id={headingId}
          className={cn("text-base font-semibold", danger ? "text-red-700" : "text-gray-900")}
        >
          {title}
        </h2>
        {description && <p className="mt-0.5 text-sm text-gray-500">{description}</p>}
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
};