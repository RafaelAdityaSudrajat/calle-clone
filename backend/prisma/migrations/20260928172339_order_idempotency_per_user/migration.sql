/*
  Warnings:

  - A unique constraint covering the columns `[userId,idempotencyKey]` on the table `Order` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Order_idempotencyKey_key";

-- CreateIndex
CREATE UNIQUE INDEX "Order_userId_idempotencyKey_key" ON "Order"("userId", "idempotencyKey");

ALTER TABLE "ProductVariant"
  ADD CONSTRAINT "ProductVariant_stock_non_negative" CHECK ("stock" >= 0);
