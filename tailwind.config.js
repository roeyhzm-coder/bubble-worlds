/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#f7f8fb",
      },
      boxShadow: {
        soft: "0 8px 28px -12px rgba(15, 23, 42, 0.18)",
        bubble: "0 10px 24px -10px rgba(15, 23, 42, 0.22)",
      },
      fontFamily: {
        sans: [
          "Heebo",
          "Assistant",
          "Segoe UI",
          "Tahoma",
          "Arial",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};
