/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#1E3A8A",
        success: "#22C55E",
        warning: "#F59E0B",
        danger: "#EF4444",
        background: "#F8FAFC",
        foreground: "#0F172A",
      },
      borderRadius: {
        xl: "16px",
      },
    },
  },
  plugins: [],
};