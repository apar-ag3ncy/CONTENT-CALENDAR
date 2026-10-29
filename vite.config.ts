import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    // Local dev only. In production (cPanel) the PHP API and the built app sit
    // on the SAME domain, so the app calls relative "/api/..." paths and Apache
    // routes them via api/.htaccess. The Vite dev server can't run PHP, so we
    // forward /api and /media to a local PHP server:
    //   php -S 127.0.0.1:8080 -t . api/router-dev.php
    proxy: {
      '/api': 'http://127.0.0.1:8080',
      '^/media(?:/|$)': 'http://127.0.0.1:8080',
    },
  },
})
