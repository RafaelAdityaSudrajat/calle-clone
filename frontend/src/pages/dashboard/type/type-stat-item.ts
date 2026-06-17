export default interface StatItem {
  title: string;
  value: string;
  trend: string;
  icon: React.ElementType;
  colors: {
    bg: string;      // Background kartu
    border: string;  // Border kartu
    iconBg: string;  // Background kotak ikon
    text: string;    // Warna teks trend
  };
}