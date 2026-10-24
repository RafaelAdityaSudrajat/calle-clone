import { Prisma } from "../../generated/prisma";
/**
 * Semua perhitungan uang WAJIB lewat helper ini, jangan pernah convert
 * Prisma.Decimal ke `number` JS di tengah jalan (rawan floating point error).
 */

export type Money = Prisma.Decimal;

/** Harga efektif variant: priceOverride kalau ada, kalau tidak pakai basePrice produk. */
export function getEffectivePrice(
  product: { basePrice: Money },
  variant: { priceOverride: Money | null },
): Money {
  return variant.priceOverride ?? product.basePrice;
}

export function subtotal(unitPrice: Money, quantity: number): Money {
  return unitPrice.mul(quantity);
}

export function sumMoney(values: Money[]): Money {
  return values.reduce((acc, v) => acc.add(v), new Prisma.Decimal(0));
}

export function hasPriceChanged(
  currentUnitPrice: Money,
  priceAtAdd: Money,
): boolean {
  return !currentUnitPrice.equals(priceAtAdd);
}

/** Serialize ke string 2 desimal untuk response JSON. Panggil ini paling akhir saja. */
export function toMoneyString(value: Money): string {
  return value.toFixed(2);
}
