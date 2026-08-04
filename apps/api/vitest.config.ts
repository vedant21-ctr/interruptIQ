import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
  },
  resolve: {
    alias: {
      '@interrupt-iq/embedding-engine': path.resolve(
        __dirname,
        '../../packages/embedding-engine/src/index.ts'
      ),
      '@interrupt-iq/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts'),
      '@interrupt-iq/ai-core': path.resolve(__dirname, '../../packages/ai-core/src/index.ts'),
    },
  },
});
