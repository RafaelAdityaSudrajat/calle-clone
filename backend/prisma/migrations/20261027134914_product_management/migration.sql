/*
  Product Management — migration (versi diperbaiki urutannya)

  Warnings:
  - DROP tabel lama "Product", "ProductImage", "ProductVariant" beserta datanya.
  - FK CartItem.productVariantId & OrderItem.productVariantId dipasang ulang ke "product_variants".
    Kalau CartItem/OrderItem masih punya baris yang merujuk varian lama, FK akan gagal.
    Di DB dev: jalankan `npx prisma migrate reset` (hapus semua data dev).
*/

-- DropForeignKey
ALTER TABLE "CartItem" DROP CONSTRAINT "CartItem_productVariantId_fkey";

-- DropForeignKey
ALTER TABLE "OrderItem" DROP CONSTRAINT "OrderItem_productVariantId_fkey";

-- DropForeignKey
ALTER TABLE "Product" DROP CONSTRAINT "Product_categoryId_fkey";

-- DropForeignKey
ALTER TABLE "ProductImage" DROP CONSTRAINT "ProductImage_productId_fkey";

-- DropForeignKey
ALTER TABLE "ProductVariant" DROP CONSTRAINT "ProductVariant_productId_fkey";

-- DropTable
DROP TABLE "Product";

-- DropTable
DROP TABLE "ProductImage";

-- DropTable
DROP TABLE "ProductVariant";

-- AlterEnum (setelah tabel lama di-drop, tidak ada kolom yang memakai enum ini)
DROP TYPE "ProductStatus";
CREATE TYPE "ProductStatus" AS ENUM ('DRAFT', 'ACTIVE', 'INACTIVE');

-- CreateTable
CREATE TABLE "Products" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "category_id" TEXT,
    "status" "ProductStatus" NOT NULL DEFAULT 'DRAFT',
    "deleted_at" TIMESTAMP(3),
    "created_by" TEXT NOT NULL,
    "updated_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductImages" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "url" VARCHAR(500) NOT NULL,
    "file_key" VARCHAR(500) NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductVariants" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "sku" VARCHAR(100) NOT NULL,
    "size" VARCHAR(20),
    "color" VARCHAR(50),
    "price" INTEGER NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "deleted_at" TIMESTAMP(3),
    "created_by" TEXT NOT NULL,
    "updated_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_variants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "products_category_id_idx" ON "Products"("category_id");

-- CreateIndex
CREATE INDEX "products_status_idx" ON "Products"("status");

-- CreateIndex
CREATE INDEX "products_deleted_at_idx" ON "Products"("deleted_at");

-- CreateIndex
CREATE INDEX "products_status_deleted_at_idx" ON "Products"("status", "deleted_at");

-- CreateIndex
CREATE INDEX "product_images_product_id_idx" ON "ProductImages"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_variants_sku_key" ON "ProductVariants"("sku");

-- CreateIndex
CREATE INDEX "product_variants_product_id_idx" ON "ProductVariants"("product_id");

-- CreateIndex
CREATE INDEX "product_variants_product_id_deleted_at_idx" ON "ProductVariants"("product_id", "deleted_at");

-- CreateIndex
CREATE INDEX "product_variants_stock_idx" ON "ProductVariants"("stock");

-- AddForeignKey
ALTER TABLE "Products" ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Products" ADD CONSTRAINT "products_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Products" ADD CONSTRAINT "products_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductImages" ADD CONSTRAINT "product_images_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "Products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductImages" ADD CONSTRAINT "product_images_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVariants" ADD CONSTRAINT "product_variants_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "Products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVariants" ADD CONSTRAINT "product_variants_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVariants" ADD CONSTRAINT "product_variants_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "ProductVariants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "ProductVariants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------- product_variants: constraint manual ----------

-- Harga wajib > 0 (BR-15), stok tidak boleh negatif (BR-16, BR-21)
ALTER TABLE "ProductVariants"
  ADD CONSTRAINT "product_variants_price_positive" CHECK ("price" > 0),
  ADD CONSTRAINT "product_variants_stock_non_negative" CHECK ("stock" >= 0);

-- Minimal salah satu dari size atau color (BR-11)
ALTER TABLE "ProductVariants"
  ADD CONSTRAINT "product_variants_attribute_required" CHECK (
    (NULLIF(BTRIM("size"), '')  IS NOT NULL) OR
    (NULLIF(BTRIM("color"), '') IS NOT NULL)
  );

-- Kombinasi (size, color) unik per produk untuk varian aktif (BR-13, DD-PM-08)
CREATE UNIQUE INDEX "product_variants_product_size_color_active_key"
  ON "ProductVariants" ("product_id", COALESCE("size", ''), COALESCE("color", ''))
  WHERE "deleted_at" IS NULL;

-- ---------- product_images: constraint manual ----------

-- Maksimal 1 primary image per produk (NFR-PM-02, EC-PM-D9)
CREATE UNIQUE INDEX "product_images_one_primary_per_product_key"
  ON "ProductImages" ("product_id")
  WHERE "is_primary" = true;