import { Button } from "./button";

interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
}

export const ErrorState = ({ message, onRetry }: ErrorStateProps) => (
  <div
    role="alert"
    className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center"
  >
    <p className="text-sm text-red-600">{message}</p>
    {onRetry && (
      <Button variant="secondary" onClick={onRetry}>
        Coba lagi
      </Button>
    )}
  </div>
);
