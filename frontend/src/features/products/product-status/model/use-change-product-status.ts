import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  getPublishFailures,
  productKeys,
  publishProduct,
  republishProduct,
  unpublishProduct,
  type PublishFailure,
  type StatusChangeResponse,
} from "@/entities/product";
import { getErrorMessage } from "@/shared/api";

export type StatusAction = "publish" | "republish" | "unpublish";

const requests: Record<StatusAction, (id: string) => Promise<StatusChangeResponse>> = {
  publish: publishProduct,
  republish: republishProduct,
  unpublish: unpublishProduct,
};

const successMessages: Record<StatusAction, string> = {
  publish: "Produk berhasil dipublikasikan",
  republish: "Produk berhasil dipublikasikan ulang",
  unpublish: "Produk dinonaktifkan",
};

interface Options {
  /** Dipanggil saat publish ditolak karena syarat belum lengkap (daftar lengkap, bukan satu-satu). */
  onBlocked?: (failures: PublishFailure[]) => void;
}

export const useChangeProductStatus = ({ onBlocked }: Options = {}) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: StatusAction }) => requests[action](id),
    onSuccess: async (_data, { action }) => {
      await queryClient.invalidateQueries({ queryKey: productKeys.all });
      toast.success(successMessages[action]);
    },
    onError: (error) => {
      const failures = getPublishFailures(error);
      if (failures.length > 0 && onBlocked) {
        onBlocked(failures);
        return;
      }
      toast.error(getErrorMessage(error));
    },
  });
};