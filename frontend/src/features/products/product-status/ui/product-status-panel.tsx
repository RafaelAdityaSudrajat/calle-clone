import { useState } from "react";
import {
  getPublishFailureLabel,
  getPublishReadiness,
  type ProductDetail,
  type ProductStatus,
  type PublishFailure,
} from "@/entities/product";
import { Button, Card } from "@/shared/ui";
import { useChangeProductStatus, type StatusAction } from "../model/use-change-product-status";

const ACTION_BY_STATUS: Record<ProductStatus, { action: StatusAction; label: string }> = {
  DRAFT: { action: "publish", label: "Publikasikan" },
  INACTIVE: { action: "republish", label: "Publikasikan ulang" },
  ACTIVE: { action: "unpublish", label: "Nonaktifkan" },
};

const STATUS_HINTS: Record<ProductStatus, string> = {
  DRAFT: "Belum tampil di toko. Lengkapi syaratnya, lalu publikasikan.",
  ACTIVE: "Produk sedang tampil di toko.",
  INACTIVE: "Produk disembunyikan dari toko.",
};

export const ProductStatusPanel = ({ product }: { product: ProductDetail }) => {
  // Kegagalan dari server (otoritatif) menggantikan checklist klien sampai aksi berikutnya.
  const [serverFailures, setServerFailures] = useState<PublishFailure[]>([]);
  const { mutate, isPending } = useChangeProductStatus({ onBlocked: setServerFailures });

  const { action, label } = ACTION_BY_STATUS[product.status];
  const failures = serverFailures.length > 0 ? serverFailures : getPublishReadiness(product);
  const showChecklist = product.status !== "ACTIVE" && failures.length > 0;

  const handleClick = () => {
    setServerFailures([]);
    mutate({ id: product.id, action });
  };

  return (
    <Card title="Status" description={STATUS_HINTS[product.status]}>
      <div className="space-y-4">
        {showChecklist && (
          <div
            role="status"
            className="p-3 text-sm border rounded-lg border-amber-200 bg-amber-50 text-amber-900"
          >
            <p className="font-medium">Belum bisa dipublikasikan:</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5">
              {failures.map((failure) => (
                <li key={failure.code}>{getPublishFailureLabel(failure)}</li>
              ))}
            </ul>
          </div>
        )}

        <Button
          className="w-full"
          variant={product.status === "ACTIVE" ? "secondary" : "primary"}
          isLoading={isPending}
          onClick={handleClick}
        >
          {label}
        </Button>
      </div>
    </Card>
  );
};