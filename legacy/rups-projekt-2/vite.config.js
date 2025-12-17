// vite.config.js (primer za navaden Vite projekt)
import { defineConfig } from 'vite';

export default defineConfig({
  // ostale nastavitve...
  server: {
    proxy: {
      "/api": "http://localhost:5500", // backend PORT
    },
  },
});