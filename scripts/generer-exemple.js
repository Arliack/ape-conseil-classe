// Régénère src/dev/questionnaire-exemple.json à partir des questions de départ de Code.gs.
// Ce fichier sert seulement en développement local quand VITE_APPS_SCRIPT_URL est vide.
import { writeFileSync } from 'node:fs';
import { questionnaireExemple } from '../tests/outils.js';

writeFileSync(new URL('../src/dev/questionnaire-exemple.json', import.meta.url), JSON.stringify(questionnaireExemple(), null, 2) + '\n');
console.log('src/dev/questionnaire-exemple.json régénéré.');
