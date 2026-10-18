import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The museum is a multi-page site: the lobby at the root and one page per exhibit (a TV generation).
// Builds use an absolute base so every page, however deep, resolves the shared public/ assets; it is
// the GitHub Pages project path (https://jacksondam.com/tizen-os-tv-web/).
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/tizen-os-tv-web/' : '/',
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        lobby: 'index.html',
        tv2013: '2013/index.html',
        tv2025: '2025/index.html',
      },
    },
  },
}))
