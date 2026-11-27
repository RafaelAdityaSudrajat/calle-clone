const formatter = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2, // kolom harga Decimal(12,2)
});

export const formatRupiah = (value: number): string => formatter.format(value);