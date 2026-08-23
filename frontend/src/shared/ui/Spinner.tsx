interface SpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeMap = {
  sm: "h-4 w-4 border-2",
  md: "h-8 w-8 border-4",
  lg: "h-12 w-12 border-4",
};

export function Spinner({ size = "md", className = "" }: SpinnerProps) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className={`animate-spin rounded-full border-solid border-blue-600 border-t-transparent ${sizeMap[size]} ${className}`}
    />
  );
}

export function FullPageSpinner() {
  return (
    <div className="flex h-screen w-full items-center justify-center">
      <Spinner size="lg" />
    </div>
  );
}
