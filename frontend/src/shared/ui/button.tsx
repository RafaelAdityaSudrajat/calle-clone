import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/shared/lib/cn";

type Variant = "primary" | "secondary" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  isLoading?: boolean;
}

const variants: Record<Variant, string> = {
  primary: "bg-black text-white hover:bg-gray-900 focus-visible:ring-gray-500",
  secondary:
    "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 focus-visible:ring-gray-400",
  danger: "bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500",
};

const Spinner = () => (
  <svg
    className="size-4 animate-spin"
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
  >
    <circle
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="4"
      className="opacity-25"
    />
    <path
      d="M4 12a8 8 0 0 1 8-8"
      stroke="currentColor"
      strokeWidth="4"
      strokeLinecap="round"
    />
  </svg>
);

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      isLoading = false,
      disabled,
      className,
      children,
      type = "button",
      ...props
    },
    ref,
  ) => (
    <button
      ref={ref}
      type={type}
      disabled={disabled || isLoading}
      aria-busy={isLoading}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-1 text-sm font-medium",
        "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant],
        className,
      )}
      {...props}
    >
      {isLoading && <Spinner />}
      {children}
    </button>
  ),
);
Button.displayName = "Button";
