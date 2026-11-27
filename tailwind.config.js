/** @type {import('tailwindcss').Config} */
export default {
  // Class strategy: the app has no dark theme yet, so `dark:` variants stay inert instead of
  // recoloring a few chips on dark-mode phones while the rest of the UI stays light.
  darkMode: "class",
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
