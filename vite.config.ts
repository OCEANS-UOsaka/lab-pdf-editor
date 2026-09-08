import { defineConfig } from 'vite';

// GitHub Pages ではリポジトリ名がパスの先頭に付く（https://oceans-uosaka.github.io/lab-pdf-editor/）。
// ローカル開発（vite dev）でも同じパスで動くので、リンクや fetch は import.meta.env.BASE_URL 基準で書く。
export default defineConfig({
  base: '/lab-pdf-editor/',
  build: {
    target: 'es2022',
    sourcemap: true,
  },
  worker: {
    format: 'es',
  },
});
