import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Publie aussi questionnaires.json à la racine du site : le script Apps Script le lit
// à cette adresse pour connaître les questions (une seule source de vérité).
function publierQuestionnaires() {
  return {
    name: 'publier-questionnaires',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'questionnaires.json',
        source: readFileSync(new URL('./src/data/questionnaires.json', import.meta.url), 'utf8'),
      });
    },
  };
}

export default defineConfig({
  // Chemins relatifs : le site fonctionne sous https://<compte>.github.io/<depot>/ sans rien régler.
  base: './',
  plugins: [react(), publierQuestionnaires()],
});
