import * as Dialog from "@radix-ui/react-dialog";
import type { ReactNode } from "react";

interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
}

// Radix menangani focus trap, Esc, scroll lock, dan ARIA.
export const Modal = ({
  open,
  onOpenChange,
  title,
  description,
  children,
}: ModalProps) => (
  <Dialog.Root open={open} onOpenChange={onOpenChange}>
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50" />
      <Dialog.Content
        {...(!description && { "aria-describedby": undefined })}
        className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-6 shadow-xl focus:outline-none"
      >
        <Dialog.Title className="text-lg font-semibold text-gray-900">
          {title}
        </Dialog.Title>
        {description && (
          <Dialog.Description className="mt-1 text-sm text-gray-500">
            {description}
          </Dialog.Description>
        )}
        <div className="mt-5">{children}</div>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>
);
