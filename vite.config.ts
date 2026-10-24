import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  build: {
    rolldownOptions: {
      output: {
        // Long-lived vendor chunks: app deploys don't invalidate the cached libraries.
        codeSplitting: {
          groups: [
            { name: "react-vendor", test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
            { name: "motion-vendor", test: /node_modules[\\/](framer-motion|motion-dom|motion-utils)[\\/]/ },
            { name: "supabase-vendor", test: /node_modules[\\/]@supabase[\\/]/ },
          ],
        },
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "pwa-192.png", "pwa-512.png"],
      manifest: {
        name: "עולמות — רעיונות ומטרות",
        short_name: "עולמות",
        description: "ניהול רעיונות, מטרות ומעקבים בבועות אינטראקטיביות",
        lang: "he",
        dir: "rtl",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        scope: "/",
        theme_color: "#f8fafc",
        background_color: "#f8fafc",
        icons: [
          {
            src: "pwa-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "pwa-512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "pwa-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        navigateFallback: "index.html",
      },
    }),
  ],
});
