/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#000000",
        secondary: "#202020",
        dashboardPrimary: "#000000",
        dashboardTextPrimary: "#334155",
      },
      fontFamily: {
        primary: ["Freeman", "sans-serif"],
      },
      spacing: {
        padding_primary: "8px",
      },
    },
    screens: {
      xs: "360px",
      sm: "480px",
      md: "600px",
      lg: "960px",
      xl: "1280px",
    },
  },
  plugins: [require("tailwind-scrollbar-hide")],
};
