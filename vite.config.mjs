import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react(), {
    name: 'csp-apenas-no-desenvolvimento',
    apply: 'serve',
    transformIndexHtml(html) {
      // O refresh local do Vite usa script inline e WebSocket; a distribuicao continua restrita.
      return html.replace("script-src 'self'", "script-src 'self' 'unsafe-inline'")
        .replace("connect-src 'self'", "connect-src 'self' ws://127.0.0.1:5178");
    }
  }],
  base: './', build: { outDir: 'dist', sourcemap: false }
});
