import { CreateProductInput } from "./product.validation";
import { GetProductsQuery } from "./product.validation";
import { NotFoundError, ConflictError } from "../../lib/errors";
import { slugify, withUniqueSuffix } from "./product.utils";
import { prisma } from "../../lib/prisma";
import { Prisma, ProductStatus } from "../../generated/prisma";
import { uploadManyToCloudinary } from "../../middlewares/upload";
import {
  AdminProductFilter,
  BuyerProductFilter,
  UpdateProductInput,
  UpdateVariantInput,
} from "./product.type";

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

// GET PRODUCT PUBLIK

export const getPublicProductsService = async (filter: BuyerProductFilter) => {
  const page = Number(filter.page) || 1;
  const limit = Number(filter.limit) || 10;
  const skip = (page - 1) * limit;
  const keyword = filter.search?.trim().slice(0, 100);

  const whereCondition: Prisma.ProductWhereInput = {
    isDeleted: false,
    status: {
      in: [ProductStatus.DRAFT, ProductStatus.OUT_OF_STOCK],
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
          select: { stock: true, priceOverride: true, id: true },
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
// GET PRODUCT ADMIN
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

// export const updateProductService = async (
//   id: string,
//   input: UpdateProductInput,
// ) => {
//   const product = await prisma.product.findUnique({ where: { id } });

//   if (!product) {
//     throw new NotFoundError("Product not found");
//   }

//   if (input.categoryId) {
//     const category = await prisma.category.findUnique({
//       where: { id: input.categoryId },
//     });
//     if (!category) throw new NotFoundError("Category not found");
//   }

//   let slug = product.slug;
//   if (input.name && input.name !== product.name) {
//     slug = await slugify(input.name);
//   }

//   return prisma.product.update({
//     where: { id },
//     data: { ...input, slug },
//     include: {
//       category: { select: { id: true, name: true, slug: true } },
//       images: { orderBy: { sortOrder: "asc" } },
//       variants: true,
//     },
//   });
// };

/**
 * FR-08, FR-09: Update Produk Induk (Non-variant data & images)
 */
export const updateProductService = async (
  productId: string,
  input: UpdateProductInput,
) => {
  return await prisma.$transaction(async (tx) => {
    // 1. Cek eksistensi produk
    const existingProduct = await tx.product.findUnique({
      where: { id: productId },
      include: { variants: true },
    });

    if (!existingProduct) {
      throw new NotFoundError("Produk tidak ditemukan");
    }

    if (existingProduct.isDeleted) {
      throw new ConflictError(
        "Produk yang sudah di-soft-delete tidak dapat diubah. Restore terlebih dahulu.",
      );
    }

    // 2. Validasi State Machine (Section 5 Business Rules)
    if (input.status) {
      if (
        existingProduct.status === ProductStatus.ARCHIVED &&
        input.status === ProductStatus.ACTIVE
      ) {
        throw new ConflictError(
          "Transisi ilegal: Produk ARCHIVED tidak boleh langsung ke ACTIVE. Harap ubah ke DRAFT terlebih dahulu.",
        );
      }

      // Cek kelengkapan jika ingin Publish ke ACTIVE (Section 3.2)
      if (input.status === ProductStatus.ACTIVE) {
        const activeVariants = existingProduct.variants.filter(
          (v) => v.isActive && v.stock > 0,
        );
        if (activeVariants.length === 0) {
          throw new Error(
            "Produk tidak dapat dipublish (ACTIVE) karena tidak memiliki variant dengan stok > 0",
          );
        }
      }
    }

    // 3. Generate Slug baru jika nama produk diubah (FR-04)
    let newSlug = undefined;
    if (input.name && input.name !== existingProduct.name) {
      const baseSlug = input.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)+/g, "");
      newSlug = `${baseSlug}-${Date.now().toString().slice(-4)}`;
    }

    // 4. Lakukan Update Data Produk
    await tx.product.update({
      where: { id: productId },
      data: {
        name: input.name,
        slug: newSlug,
        categoryId: input.categoryId,
        description: input.description,
        basePrice:
          input.basePrice !== undefined
            ? new Prisma.Decimal(input.basePrice)
            : undefined,
        status: input.status,
      },
    });

    // 5. Update Images (Jika dilampirkan)
    if (input.images && input.images.length > 0) {
      // Hapus gambar lama dan replace dengan urutan baru (Cara terbersih untuk re-order image)
      await tx.productImage.deleteMany({
        where: { productId: productId },
      });

      await tx.productImage.createMany({
        data: input.images.map((img, idx) => ({
          productId: productId,
          url: img.url,
          isPrimary: img.isPrimary !== undefined ? img.isPrimary : idx === 0,
          sortOrder: img.sortOrder !== undefined ? img.sortOrder : idx,
        })),
      });
    }

    // 6. Return data terbaru
    return await tx.product.findUnique({
      where: { id: productId },
      include: {
        category: true,
        images: { orderBy: { sortOrder: "asc" } },
        variants: { orderBy: { sku: "asc" } },
      },
    });
  });
};

export const updateProductVariantService = async (
  variantId: string,
  input: UpdateVariantInput,
) => {
  return await prisma.$transaction(async (tx) => {
    // 1. Cek eksistensi varian
    const existingVariant = await tx.productVariant.findUnique({
      where: { id: variantId },
      include: { product: true },
    });

    if (!existingVariant) {
      throw new NotFoundError("Variant produk tidak ditemukan");
    }

    // 2. Validasi Stok Tidak Boleh Negatif (Section 3.2)
    if (input.stock !== undefined && input.stock < 0) {
      throw new ConflictError("Stok tidak boleh bernilai negatif");
    }

    // 3. Lakukan Update pada Variant
    const updatedVariant = await tx.productVariant.update({
      where: { id: variantId },
      data: {
        sku: input.sku,
        size: input.size,
        color: input.color,
        priceOverride:
          input.priceOverride !== undefined
            ? input.priceOverride === null
              ? null
              : new Prisma.Decimal(input.priceOverride)
            : undefined,
        stock: input.stock,
        isActive: input.isActive,
      },
    });

    // 4. SYSTEM AUTOMATION (FR-14, FR-15, FR-16)
    await runStockAutomation(tx, existingVariant.productId);

    return updatedVariant;
  });
};

/**
 * Helper Private: System Automation untuk Stok & Status Produk Induk
 */
const runStockAutomation = async (
  tx: Prisma.TransactionClient,
  productId: string,
) => {
  // Ambil seluruh varian aktif untuk produk ini
  const activeVariants = await tx.productVariant.findMany({
    where: { productId: productId, isActive: true },
  });

  const totalStock = activeVariants.reduce((sum, v) => sum + v.stock, 0);
  const parentProduct = await tx.product.findUnique({
    where: { id: productId },
  });

  if (!parentProduct) return;

  // FR-15: Saat semua varian aktif dari 1 produk stoknya habis (0) -> Ubah status produk jadi OUT_OF_STOCK
  if (totalStock === 0 && parentProduct.status === ProductStatus.ACTIVE) {
    await tx.product.update({
      where: { id: productId },
      data: { status: ProductStatus.OUT_OF_STOCK },
    });
  }
  // FR-16: Saat produk sedang OUT_OF_STOCK dan stok di-restock (>0) -> Otomatis kembali ke ACTIVE
  else if (
    totalStock > 0 &&
    parentProduct.status === ProductStatus.OUT_OF_STOCK
  ) {
    await tx.product.update({
      where: { id: productId },
      data: { status: ProductStatus.ACTIVE },
    });
  }
};

/**
 * FR-11 & FR-12: Delete Product Induk
 * - Soft-delete (ARCHIVED) jika sudah pernah bertransaksi.
 * - Hard-delete jika belum pernah ada histori transaksi sama sekali.
 */
export const deleteProductService = async (productId: string) => {
  return await prisma.$transaction(async (tx) => {
    // 1. Cek eksistensi produk
    const product = await tx.product.findUnique({
      where: { id: productId },
      include: {
        variants: {
          include: {
            _count: {
              select: { cartItems: true }, // Menggunakan cartItems sebagai acuan histori order/cart
            },
          },
        },
      },
    });

    if (!product) {
      throw new NotFoundError("Produk tidak ditemukan");
    }

    if (product.isDeleted) {
      throw new ConflictError(
        "Produk sudah dalam status terhapus (soft-deleted)",
      );
    }

    // 2. Hitung total transaksi/histori order dari seluruh varian produk ini
    const totalOrderHistory = product.variants.reduce(
      (total, variant) => total + variant._count.cartItems,
      0,
    );

    // 3. Apply Business Rules FR-11 & FR-12
    if (totalOrderHistory > 0) {
      // FR-11: Sudah ada histori order -> Wajib Soft-Delete (ARCHIVED)
      const updatedProduct = await tx.product.update({
        where: { id: productId },
        data: {
          isDeleted: true,
          status: ProductStatus.ARCHIVED,
          deletedAt: new Date(),
          // Nonaktifkan semua varian agar tidak bisa dibeli lagi (FR-13 & Section 3.2)
          variants: {
            updateMany: {
              where: {},
              data: { isActive: false },
            },
          },
        },
      });

      return {
        deleteType: "SOFT_DELETE",
        message:
          "Produk berhasil di-soft-delete (diarsipkan) karena memiliki histori transaksi.",
        data: updatedProduct,
      };
    } else {
      // FR-12: Belum pernah ada transaksi -> Boleh Hard-Delete permanen dari DB
      // Catatan: relasi images dan variants akan otomatis terhapus karena aturan onDelete: Cascade di schema
      await tx.product.delete({
        where: { id: productId },
      });

      return {
        deleteType: "HARD_DELETE",
        message: "Produk berhasil dihapus permanen dari sistem.",
        data: null,
      };
    }
  });
};

/**
 * FR-13 & Section 3.2: Delete/Disable Product Variant (Level SKU)
 * - Variant yang pernah di-order TIDAK BOLEH dihapus, hanya dinonaktifkan (isActive: false).
 * - Variant yang belum pernah di-order boleh di-hard-delete.
 */
export const deleteProductVariantService = async (variantId: string) => {
  return await prisma.$transaction(async (tx) => {
    // 1. Cek eksistensi varian beserta hitungan historinya
    const variant = await tx.productVariant.findUnique({
      where: { id: variantId },
      include: {
        _count: {
          select: { cartItems: true },
        },
      },
    });

    if (!variant) {
      throw new NotFoundError("Variant produk tidak ditemukan");
    }

    // 2. Apply Business Rules FR-13
    if (variant._count.cartItems > 0) {
      if (!variant.isActive) {
        throw new ConflictError(
          "Variant produk ini sudah dalam keadaan nonaktif",
        );
      }

      // Sudah pernah di-order -> Hanya boleh di-nonaktifkan
      const disabledVariant = await tx.productVariant.update({
        where: { id: variantId },
        data: { isActive: false },
      });

      // Cek Automation FR-15: Apakah setelah variant ini dinonaktifkan, semua varian produk induknya mati?
      await checkAndSyncParentProductStatus(tx, variant.productId);

      return {
        deleteType: "SOFT_DISABLE",
        message:
          "Variant telah dinonaktifkan karena sudah memiliki histori transaksi.",
        data: disabledVariant,
      };
    } else {
      // Belum pernah di-order -> Hard delete
      const productId = variant.productId;
      await tx.productVariant.delete({
        where: { id: variantId },
      });

      // Sync status produk induk setelah deletion
      await checkAndSyncParentProductStatus(tx, productId);

      return {
        deleteType: "HARD_DELETE",
        message: "Variant produk berhasil dihapus permanen.",
        data: null,
      };
    }
  });
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

/**
 * Helper Private: Automation (FR-15)
 * Mengubah status produk induk ke OUT_OF_STOCK / INACTIVE jika semua variannya habis/nonaktif.
 */
const checkAndSyncParentProductStatus = async (
  tx: Prisma.TransactionClient,
  productId: string,
) => {
  const activeVariants = await tx.productVariant.findMany({
    where: {
      productId: productId,
      isActive: true,
    },
  });

  if (activeVariants.length === 0) {
    // Jika tidak ada lagi varian yang aktif, ubah produk induk menjadi OUT_OF_STOCK
    await tx.product.update({
      where: { id: productId },
      data: { status: ProductStatus.OUT_OF_STOCK },
    });
  }
};
