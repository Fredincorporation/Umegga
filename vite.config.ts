import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const musicCacheHeaders = {
  'Cache-Control': 'public, max-age=31536000, immutable',
};

const musicCachePlugin = {
  name: 'music-cache-headers',
  configureServer(server: { middlewares: { use: (handler: (request: any, response: any, next: () => void) => void) => void } }) {
    server.middlewares.use((request, response, next) => {
      if (request.url?.match(/^\/music\/[^/?]+\.ogg(?:\?|$)/)) {
        Object.entries(musicCacheHeaders).forEach(([key, value]) => response.setHeader(key, value));
      }
      next();
    });
  },
  configurePreviewServer(server: { middlewares: { use: (handler: (request: any, response: any, next: () => void) => void) => void } }) {
    server.middlewares.use((request, response, next) => {
      if (request.url?.match(/^\/music\/[^/?]+\.ogg(?:\?|$)/)) {
        Object.entries(musicCacheHeaders).forEach(([key, value]) => response.setHeader(key, value));
      }
      next();
    });
  },
};

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), musicCachePlugin],
  server: {
    port: 3000,
    host: true,
  },
  build: {
    target: 'esnext',
  },
});
