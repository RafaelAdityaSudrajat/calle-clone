/**
 * Generate slug dasar dari nama produk.
 * Contoh: "Kaos Polos Basic" -> "kaos-polos-basic"
 */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

/**
 * Tambahkan suffix random pendek untuk menghindari collision slug.
 * Dipanggil kalau slug dasar sudah ada di DB.
 */
export function withUniqueSuffix(baseSlug: string): string {
  const suffix = Math.random().toString(36).substring(2, 7); // 5 char random
  return `${baseSlug}-${suffix}`;
}