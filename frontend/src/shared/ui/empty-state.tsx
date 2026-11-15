import type { ReactNode } from "react";

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

export const EmptyState = ({ title, description, action }: EmptyStateProps) => (
  <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
    <h3 className="text-base font-semibold text-gray-900">{title}</h3>
    {description && (
      <p className="max-w-sm text-sm text-gray-500">{description}</p>
    )}
    {action && <div className="mt-3">{action}</div>}
  </div>
);
