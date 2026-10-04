/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png', 'icono.svg'],
      manifest: {
        name: 'Antigravity Caja',
        short_name: 'Caja',
        description: 'Caja rápida, inventario y control de la plata de tu negocio',
        lang: 'es-CO',
        start_url: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#ffffff',
        theme_color: '#e53935',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // La app abre sin señal: el service worker guarda el HTML/JS/CSS. La API nunca se cachea aquí.
        // Las tipografías y los personajes también se guardan: la app abre completa sin señal
        globPatterns: ['**/*.{js,css,html,woff2,svg,png,ico}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/actuator\//],
      },
    }),
  ],
  build: {
    // iPhone X: Safari 16 como máximo
    target: ['es2020', 'safari16'],
  },
  server: {
    port: Number(process.env.PORT) || 5173,
    strictPort: true,
    // Todo lo de /api lo atiende Spring Boot en :8080. Tú solo abres :5173
    proxy: {
      '/api': 'http://localhost:8080',
      '/actuator': 'http://localhost:8080',
    },
  },
  test: {
    environment: 'jsdom',
  },
})
