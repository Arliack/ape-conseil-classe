// Outils communs aux tests : chargement du JSON et du script Apps Script dans une VM Node.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const racine = new URL('../', import.meta.url);

export function chargerDonnees() {
  return JSON.parse(readFileSync(new URL('src/data/questionnaires.json', racine), 'utf8'));
}

/**
 * Exécute apps-script/Code.gs dans un contexte isolé. Les services Google sont remplacés par
 * des bouchons minimaux : seules les fonctions pures sont testées ici.
 */
export function chargerAppsScript() {
  const code = readFileSync(new URL('apps-script/Code.gs', racine), 'utf8');
  const contexte = {
    console,
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput(texte) {
        return { texte, setMimeType() { return this; } };
      },
    },
  };
  vm.createContext(contexte);
  vm.runInContext(code, contexte, { filename: 'Code.gs' });
  return contexte;
}

/** Générateur pseudo-aléatoire reproductible (mulberry32). */
export function aleatoire(graine) {
  let a = graine >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
