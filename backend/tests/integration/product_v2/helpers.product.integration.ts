import { prisma } from "../../../src/lib/prisma";

export interface SeedProductOpts {
  name: string;
  status?: "DRAFT" | "ACTIVE" | "INACTIVE";
  categoryId?: string | null;
  deletedAt?: Date | null;
  createdBy: string;
  variants?: Array<{
    sku: string;
    price: number;
    stock: number;
    size?: string | null;
    color?: string | null;
    deletedAt?: Date | null;
  }>;
  images?: Array<{
    url: string;
    isPrimary: boolean;
    sortOrder?: number;
  }>;
  createdAt?: Date;
}

export async function seedProduct(opts: SeedProductOpts) {
  return prisma.product.create({
    data: {
      name: opts.name,
      status: opts.status ?? "DRAFT",
      categoryId: opts.categoryId ?? null,
      deletedAt: opts.deletedAt ?? null,
      createdBy: opts.createdBy,
      updatedBy: opts.createdBy,
      variants: opts.variants?.length
        ? {
            create: opts.variants.map((v, i) => ({
              sku: v.sku,
              price: v.price,
              stock: v.stock,
              size: v.size ?? (v.color ? null : `S${i}`),
              color: v.color ?? null,
              deletedAt: v.deletedAt ?? null,
              createdBy: opts.createdBy,
              updatedBy: opts.createdBy,
            })),
          }
        : undefined,
      images: opts.images?.length
        ? {
            create: opts.images.map((i) => ({
              url: i.url,
              fileKey: `key-${i.url}`,
              isPrimary: i.isPrimary,
              sortOrder: i.sortOrder ?? 0,
              createdBy: opts.createdBy,
            })),
          }
        : undefined,
    },
  });
}
