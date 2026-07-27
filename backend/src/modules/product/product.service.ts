import { CreateProductInput } from "./product.validation";
import { GetProductsQuery } from "./product.validation";
import { UpdateProductInput } from "./product.validation";
import { NotFoundError, ConflictError } from "../../lib/errors";
import { slugify, withUniqueSuffix } from "./product.utils";
import { prisma } from "../../lib/prisma";
import { Prisma, ProductStatus } from "../../generated/prisma";
import { uploadManyToCloudinary } from "../../middlewares/upload";
import { AdminProductFilter, BuyerProductFilter } from "./product.type";

const MAX_SLUG_RETRY = 3;
const MAX_IMAGES_PER_PRODUCT = 8;

/**
 * Create product beserta images & variants dalam satu transaction.
 * Kenapa transaction: kalau insert variant gagal (misal SKU collision
 * yang lolos validasi Zod tapi bentrok sama produk lain di DB),
 * produk induk yang setengah jadi tidak boleh nyangkut di DB.
 */
export async function createProductService(input: CreateProductInput) {
  const baseSlug = slugify(input.name);

  let slugToUse = baseSlug;
  let attempt = 0;

  // Cek uniqueness slug, retry dengan suffix kalau bentrok.
  // Di-loop di luar transaction supaya transaction tetap ringkas.
  while (attempt < MAX_SLUG_RETRY) {
    const existing = await prisma.product.findUnique({
      where: { slug: slugToUse },
      select: { id: true },
    });

    if (!existing) break;

    slugToUse = withUniqueSuffix(baseSlug);
    attempt++;
  }

  if (attempt === MAX_SLUG_RETRY) {
    throw new ConflictError("Gagal generate slug unik, coba ubah nama produk");
  }

  try {
    const product = await prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: {
          categoryId: input.categoryId,
          name: input.name,
          slug: slugToUse,
          description: input.description,
          basePrice: input.basePrice,
          status: "DRAFT", // business rule: produk baru selalu DRAFT
          images: {
            create: input.images.map((img) => ({
              url: img.url,
              isPrimary: img.isPrimary,
              sortOrder: img.sortOrder,
            })),
          },
          variants: {
            create: input.variants.map((v) => ({
              sku: v.sku,
              size: v.size,
              color: v.color,
              priceOverride: v.priceOverride,
              stock: v.stock,
            })),
          },
        },
        include: {
          images: true,
          variants: true,
          category: { select: { id: true, name: true } },
        },
      });

      return created;
    });

    return product;
  } catch (err) {
    // Tangani unique constraint (SKU sudah dipakai produk lain, dsb)
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      const target = (err.meta?.target as string[])?.join(", ") ?? "field";
      throw new ConflictError(`Data duplikat pada: ${target}`);
    }

    // Category tidak ditemukan (foreign key constraint gagal)
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2003"
    ) {
      throw new ConflictError("categoryId tidak ditemukan");
    }

    throw err;
  }
}

// get products

export const getPublicProductsService = async (filter: BuyerProductFilter) => {
  const page = Number(filter.page) || 1;
  const limit = Number(filter.limit) || 10;
  const skip = (page - 1) * limit;
  const keyword = filter.search?.trim().slice(0, 100);

  const whereCondition: Prisma.ProductWhereInput = {
    isDeleted: false,
    status: {
      in: [ProductStatus.ACTIVE, ProductStatus.OUT_OF_STOCK],
    },
  };

  // Filter Search by Name atau Slug
  if (keyword) {
    whereCondition.OR = [
      { name: { contains: keyword, mode: "insensitive" } },
      { description: { contains: keyword, mode: "insensitive" } },
    ];
  }

  // Filter by Category Slug
  if (filter.categorySlug) {
    whereCondition.category = {
      slug: filter.categorySlug,
    };
  }

  const [total, products] = await Promise.all([
    prisma.product.count({ where: whereCondition }),
    prisma.product.findMany({
      where: whereCondition,
      skip,
      take: limit,
      orderBy: {
        [filter.sortBy || "createdAt"]: filter.sortOrder || "desc",
      },
      select: {
        id: true,
        name: true,
        slug: true,
        basePrice: true,
        status: true,
        category: {
          select: { id: true, name: true, slug: true },
        },
        // Hanya ambil gambar primary atau urutan pertama untuk listing
        images: {
          where: { isPrimary: true },
          take: 1,
          select: { url: true, isPrimary: true },
        },
        // Hitung total stok dari semua varian yang aktif
        variants: {
          where: { isActive: true },
          select: { stock: true, priceOverride: true },
        },
      },
    }),
  ]);

  return {
    data: products,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};

/**
 * FR-05 & US-06: Detail produk publik berdasarkan SLUG
 */
export const getPublicProductBySlugService = async (slug: string) => {
  const product = await prisma.product.findFirst({
    where: {
      slug,
      isDeleted: false,
      status: {
        in: [ProductStatus.ACTIVE, ProductStatus.OUT_OF_STOCK],
      },
    },
    include: {
      category: {
        select: { id: true, name: true, slug: true },
      },
      images: {
        orderBy: { sortOrder: "asc" },
      },
      // Hanya tampilkan varian yang aktif (FR-13)
      variants: {
        where: { isActive: true },
        orderBy: { sku: "asc" },
      },
    },
  });

  if (!product) {
    throw new NotFoundError("Produk tidak ditemukan atau tidak tersedia");
    // Catatan: Gunakan custom AppError kamu di sini jika ada (misal: new AppError('Not Found', 404))
  }

  return product;
};

/**
 * FR-07: Produk ARCHIVED tetap bisa diakses via ID (untuk histori order di level Buyer/System)
 */
export const getProductByIdForOrderHistoryService = async (id: string) => {
  const product = await prisma.product.findFirst({
    where: {
      id,
      isDeleted: false,
      status: {
        in: [
          ProductStatus.ACTIVE,
          ProductStatus.OUT_OF_STOCK,
          ProductStatus.ARCHIVED,
        ],
      },
    },
    include: {
      category: true,
      images: true,
      variants: true, // Tampilkan semua varian agar detail histori order tidak rusak
    },
  });

  if (!product) {
    throw new NotFoundError("Data produk untuk histori ini tidak ditemukan");
  }

  return product;
};

// ==========================================
// ADMIN ENDPOINTS
// ==========================================

/**
 * FR-06: Admin bisa memfilter produk berdasarkan semua status (termasuk DRAFT, ARCHIVED, & isDeleted)
 */
export const getAdminProductsService = async (filter: AdminProductFilter) => {
  const page = Number(filter.page) || 1;
  const limit = Number(filter.limit) || 10;
  const skip = (page - 1) * limit;

  const whereCondition: Prisma.ProductWhereInput = {};

  // Filter status jika dikirim oleh admin
  if (filter.status) {
    whereCondition.status = filter.status;
  }

  // Filter status soft-delete (default false jika tidak didefinisikan)
  if (filter.isDeleted !== undefined) {
    whereCondition.isDeleted = String(filter.isDeleted) === "true";
  }

  if (filter.categoryId) {
    whereCondition.categoryId = filter.categoryId;
  }

  if (filter.search) {
    whereCondition.OR = [
      { name: { contains: filter.search, mode: "insensitive" } },
      { slug: { contains: filter.search, mode: "insensitive" } },
    ];
  }

  const [total, products] = await Promise.all([
    prisma.product.count({ where: whereCondition }),
    prisma.product.findMany({
      where: whereCondition,
      skip,
      take: limit,
      orderBy: {
        [filter.sortBy || "createdAt"]: filter.sortOrder || "desc",
      },
      include: {
        category: { select: { name: true } },
        _count: {
          select: { variants: true, images: true },
        },
      },
    }),
  ]);

  return {
    data: products,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};

/**
 * Admin: Get detail lengkap produk tanpa restriksi status atau isDeleted
 */
export const getAdminProductByIdService = async (id: string) => {
  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      category: true,
      images: {
        orderBy: { sortOrder: "asc" },
      },
      variants: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!product) {
    throw new NotFoundError("Produk tidak ditemukan");
  }

  return product;
};

export const updateProductService = async (
  id: string,
  input: UpdateProductInput,
) => {
  const product = await prisma.product.findUnique({ where: { id } });

  if (!product) {
    throw new NotFoundError("Product not found");
  }

  if (input.categoryId) {
    const category = await prisma.category.findUnique({
      where: { id: input.categoryId },
    });
    if (!category) throw new NotFoundError("Category not found");
  }

  let slug = product.slug;
  if (input.name && input.name !== product.name) {
    slug = await slugify(input.name);
  }

  return prisma.product.update({
    where: { id },
    data: { ...input, slug },
    include: {
      category: { select: { id: true, name: true, slug: true } },
      images: { orderBy: { sortOrder: "asc" } },
      variants: true,
    },
  });
};

export const getProductsService = async (query: GetProductsQuery) => {
  const { page, limit, search, categoryId, isActive } = query;
  const skip = (page - 1) * limit;

  const where = {
    ...(search && {
      name: { contains: search, mode: "insensitive" as const },
    }),
    ...(categoryId && { categoryId }),
    ...(isActive !== undefined && { isActive }),
  };

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        images: { where: { isPrimary: true }, take: 1 },
        variants: true,
      },
    }),
    prisma.product.count({ where }),
  ]);

  return {
    data: products,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};

export const getProductByIdService = async (id: string) => {
  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      category: { select: { id: true, name: true, slug: true } },
      images: { orderBy: { sortOrder: "asc" } },
      variants: true,
    },
  });

  if (!product) {
    throw new NotFoundError("Product not found");
  }

  return product;
};

export const deleteProductService = async (id: string) => {
  const product = await prisma.product.findUnique({ where: { id } });

  if (!product) {
    throw new NotFoundError("Product not found");
  }

  await prisma.product.delete({ where: { id } });
};

export const uploadProductImages = async (
  productId: string,
  files: Express.Multer.File[],
) => {
  // 1. Validasi produk exist SEBELUM upload ke Cloudinary,
  //    biar gak ada file ke-upload sia-sia kalau productId salah.
  const product = await prisma.product.findUnique({
    where: { id: productId, isDeleted: false },
    select: {
      id: true,
      _count: { select: { images: true } },
    },
  });

  if (!product) {
    throw new ConflictError("Produk tidak ditemukan");
  }

  // 2. Cek batas jumlah gambar (existing + baru gak boleh lewat limit)
  if (product._count.images + files.length > MAX_IMAGES_PER_PRODUCT) {
    throw new ConflictError(
      `Maksimal ${MAX_IMAGES_PER_PRODUCT} gambar per produk`,
    );
  }

  // 3. Cek apakah produk ini sudah punya primary image.
  //    Kalau belum ada sama sekali, gambar pertama yang baru
  //    di-upload otomatis jadi primary. Kalau sudah ada, gambar
  //    baru semua isPrimary: false (gak menimpa primary lama).
  const hasPrimaryAlready = await prisma.productImage.findFirst({
    where: { productId, isPrimary: true },
    select: { id: true },
  });

  // 4. Upload ke Cloudinary — reuse helper yang sama dengan create product,
  //    jadi cuma ada SATU cara upload di seluruh codebase.
  const uploaded = await uploadManyToCloudinary(files, "products");

  // 5. Insert semua record sekaligus dalam transaction —
  //    kalau salah satu insert gagal, semuanya rollback,
  //    daripada nyisain data setengah-setengah.
  const images = await prisma.$transaction(
    uploaded.map((img, index) =>
      prisma.productImage.create({
        data: {
          productId,
          url: img.url,
          isPrimary: !hasPrimaryAlready && index === 0,
          sortOrder: product._count.images + index,
        },
      }),
    ),
  );

  return images;
};
