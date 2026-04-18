/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
      },
      colors: {
        surface: {
          light: "#ffffff",
          "light-2": "#f7f7f8",
          "light-3": "#ececee",
          dark: "#0b0b0d",
          "dark-2": "#141418",
          "dark-3": "#1f1f25",
        },
      },
      boxShadow: {
        card: "0 1px 2px rgba(0,0,0,0.04), 0 2px 8px rgba(0,0,0,0.04)",
        "card-dark":
          "0 1px 2px rgba(0,0,0,0.35), 0 2px 10px rgba(0,0,0,0.35)",
      },
    },
  },
  plugins: [],
};
