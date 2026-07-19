export function formatRupiah(angka: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0, // Mengilangkan ,00 di belakang angka jika tidak dibutuhkan
  }).format(angka);
}
