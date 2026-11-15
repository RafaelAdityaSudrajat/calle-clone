import { Button } from "./button";
import { Modal } from "./modal";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isLoading?: boolean;
  onConfirm: () => void;
}

export const ConfirmDialog = ({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Hapus",
  cancelLabel = "Batal",
  isLoading = false,
  onConfirm,
}: ConfirmDialogProps) => (
  <Modal
    open={open}
    // Cegah dialog tertutup saat request sedang berjalan.
    onOpenChange={(next) => !isLoading && onOpenChange(next)}
    title={title}
    description={description}
  >
    <div className="flex justify-end gap-3">
      <Button
        variant="secondary"
        disabled={isLoading}
        onClick={() => onOpenChange(false)}
      >
        {cancelLabel}
      </Button>
      <Button variant="danger" isLoading={isLoading} onClick={onConfirm}>
        {confirmLabel}
      </Button>
    </div>
  </Modal>
);
