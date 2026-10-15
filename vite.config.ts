import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Relative base: the build works at a domain root and under a sub-path such as
// https://jacksondam.com/tizen-os-tv-web/ (GitHub Pages project site).
export default defineConfig({
  base: './',
  plugins: [react()],
})
