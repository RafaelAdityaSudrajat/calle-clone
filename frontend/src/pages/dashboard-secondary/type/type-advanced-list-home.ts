export default interface AdvancedStatItem {
  value: string;
  label: string;
  trend: string;
  trendColor: string; // Tailwind class untuk warna teks trend
  icon: React.ElementType;
  iconColor: string;  // Tailwind class untuk warna ikon
}
