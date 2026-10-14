import { Prisma } from "../../../src/generated/prisma";
import { prisma } from "../../../src/lib/prisma";

export async function seedOrder(
  userId: string,
  opts: {
    status?: "PENDING_PAYMENT" | "PAID" | "CANCELLED";
    paymentStatus?: "UNPAID" | "PAID" | "FAILED" | "REFUNDED";
    totalAmount?: string;
    paidAt?: Date | null;
    createdAt?: Date;
    idempotencyKey?: string;
    items?: Array<{
      productVariantId: string;
      productName?: string;
      variantSku?: string;
      unitPrice?: string;
      quantity?: number;
    }>;
  } = {},
) {
  const items = (opts.items ?? []).map((it) => {
    const unitPrice = new Prisma.Decimal(it.unitPrice ?? "100000.00");
    const quantity = it.quantity ?? 1;
    return {
      productVariantId: it.productVariantId,
      productName: it.productName ?? "Default Product",
      variantSku: it.variantSku ?? "DEFAULT-SKU",
      unitPrice,
      quantity,
      subtotal: unitPrice.mul(quantity),
    };
  });

  return prisma.order.create({
    data: {
      userId,
      status: opts.status ?? "PENDING_PAYMENT",
      paymentStatus: opts.paymentStatus ?? "UNPAID",
      totalAmount: new Prisma.Decimal(opts.totalAmount ?? "100000.00"),
      paidAt: opts.paidAt ?? null,
      ...(opts.createdAt ? { createdAt: opts.createdAt } : {}),
      idempotencyKey: opts.idempotencyKey ?? `key-${crypto.randomUUID()}`,
      shippingRecipientName: "Test Receiver",
      shippingPhone: "081234567890",
      shippingAddressLine: "Jl. Test No. 1",
      shippingCity: "Bandung",
      shippingPostalCode: "40111",
      items: { create: items },
    },
    include: { items: true },
  });
}
