-- AlterTable
ALTER TABLE "ProductImages" RENAME CONSTRAINT "product_images_pkey" TO "ProductImages_pkey";

-- AlterTable
ALTER TABLE "ProductVariants" RENAME CONSTRAINT "product_variants_pkey" TO "ProductVariants_pkey";

-- AlterTable
ALTER TABLE "Products" RENAME CONSTRAINT "products_pkey" TO "Products_pkey";

-- RenameForeignKey
ALTER TABLE "ProductImages" RENAME CONSTRAINT "product_images_created_by_fkey" TO "ProductImages_created_by_fkey";

-- RenameForeignKey
ALTER TABLE "ProductImages" RENAME CONSTRAINT "product_images_product_id_fkey" TO "ProductImages_product_id_fkey";

-- RenameForeignKey
ALTER TABLE "ProductVariants" RENAME CONSTRAINT "product_variants_created_by_fkey" TO "ProductVariants_created_by_fkey";

-- RenameForeignKey
ALTER TABLE "ProductVariants" RENAME CONSTRAINT "product_variants_product_id_fkey" TO "ProductVariants_product_id_fkey";

-- RenameForeignKey
ALTER TABLE "ProductVariants" RENAME CONSTRAINT "product_variants_updated_by_fkey" TO "ProductVariants_updated_by_fkey";

-- RenameForeignKey
ALTER TABLE "Products" RENAME CONSTRAINT "products_category_id_fkey" TO "Products_category_id_fkey";

-- RenameForeignKey
ALTER TABLE "Products" RENAME CONSTRAINT "products_created_by_fkey" TO "Products_created_by_fkey";

-- RenameForeignKey
ALTER TABLE "Products" RENAME CONSTRAINT "products_updated_by_fkey" TO "Products_updated_by_fkey";

-- RenameIndex
ALTER INDEX "product_images_product_id_idx" RENAME TO "ProductImages_product_id_idx";

-- RenameIndex
ALTER INDEX "product_variants_product_id_deleted_at_idx" RENAME TO "ProductVariants_product_id_deleted_at_idx";

-- RenameIndex
ALTER INDEX "product_variants_product_id_idx" RENAME TO "ProductVariants_product_id_idx";

-- RenameIndex
ALTER INDEX "product_variants_sku_key" RENAME TO "ProductVariants_sku_key";

-- RenameIndex
ALTER INDEX "product_variants_stock_idx" RENAME TO "ProductVariants_stock_idx";

-- RenameIndex
ALTER INDEX "products_category_id_idx" RENAME TO "Products_category_id_idx";

-- RenameIndex
ALTER INDEX "products_deleted_at_idx" RENAME TO "Products_deleted_at_idx";

-- RenameIndex
ALTER INDEX "products_status_deleted_at_idx" RENAME TO "Products_status_deleted_at_idx";

-- RenameIndex
ALTER INDEX "products_status_idx" RENAME TO "Products_status_idx";
