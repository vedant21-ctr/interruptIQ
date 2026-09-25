import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vitejs.dev/config/
export default defineConfig({
  css: {
    devSourcemap: false,
  } as any,
  plugins: [react(), tailwindcss()],
});
