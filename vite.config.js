import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Chemins relatifs : le site fonctionne sous https://<compte>.github.io/<depot>/ sans rien régler.
  base: './',
  plugins: [react()],
});
