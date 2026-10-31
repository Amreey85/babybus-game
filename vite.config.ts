import { defineConfig } from 'vite';

export default defineConfig({
  // Relative base so the build works from any static host or sub-path.
  base: './',
  build: {
    target: 'es2020',
    sourcemap: false,
    chunkSizeWarningLimit: 2500,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules/@babylonjs')) return 'babylon';
          return undefined;
        },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts'],
  },
} as any);
