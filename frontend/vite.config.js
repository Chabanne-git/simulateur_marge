import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // GitHub Pages sert l'app sous /<repo>/
  base: process.env.GITHUB_PAGES ? '/simulateur_marge/' : '/',
});
