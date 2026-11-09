-- ============================================================
-- Product Management: business-rule constraints
-- Constraint ini tidak bisa diekspresikan di Prisma schema,
-- jadi ditulis manual di sini. Source of truth = file ini.
-- ============================================================

-- ---------- ProductVariant: CHECK (BR-11, BR-15, BR-16, BR-21) ----------
ALTER TABLE "ProductVariant"
  ADD CONSTRAINT "ProductVariant_price_positive_check"
    CHECK ("price" > 0),
  ADD CONSTRAINT "ProductVariant_stock_non_negative_check"
    CHECK ("stock" >= 0),
  ADD CONSTRAINT "ProductVariant_attribute_required_check"
    CHECK (
      (NULLIF(BTRIM("size"), '')  IS NOT NULL) OR
      (NULLIF(BTRIM("color"), '') IS NOT NULL)
    );

-- ---------- ProductVariant: unique kombinasi per produk (BR-13, DD-PM-08) ----------
-- COALESCE wajib: di Postgres, UNIQUE menganggap NULL distinct (dua varian
-- dengan size NULL & color "Hitam" akan lolos tanpa COALESCE).
-- WHERE deleted_at IS NULL: varian soft-deleted boleh punya kombinasi sama.
CREATE UNIQUE INDEX "ProductVariant_product_size_color_active_key"
  ON "ProductVariant" ("product_id", COALESCE("size", ''), COALESCE("color", ''))
  WHERE "deleted_at" IS NULL;

-- ---------- ProductImage: maksimal 1 primary per produk (BR-18, NFR-PM-02) ----------
-- Partial unique mencegah race condition 2 admin set primary bersamaan (EC-PM-D9).
CREATE UNIQUE INDEX "ProductImage_one_primary_per_product_key"
  ON "ProductImage" ("product_id")
  WHERE "is_primary" = true;