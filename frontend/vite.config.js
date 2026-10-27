/** Configure the React build and isolated component test environment. */
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

/** Resolve local server ports without exposing configuration to the client. */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    server: { port: Number(env.DEV_PORT || 5173), strictPort: true },
    preview: { port: Number(env.PLAYWRIGHT_PORT || 4173), strictPort: true },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.js'],
      include: ['src/**/*.test.{js,jsx}'],
      exclude: ['e2e/**', 'node_modules/**', 'dist/**'],
    },
  };
});
