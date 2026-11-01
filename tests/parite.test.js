// Le front (src/lib/questionnaire.js) et le script (apps-script/Code.gs) appliquent les mêmes
// règles d'affichage. Sur des réponses tirées au hasard, on vérifie que :
//  - toute réponse que le front laisse envoyer est acceptée par le script ;
//  - les deux gardent exactement les mêmes champs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aleatoire, chargerAppsScript, chargerDonnees } from './outils.js';
import { construirePayload, erreursTheme, optionsDe, precisionSi, themesVisibles } from '../src/lib/questionnaire.js';

const gs = chargerAppsScript();
const data = chargerDonnees();

function tirerReponses(q, hasard) {
  const choisir = (liste) => liste[Math.floor(hasard() * liste.length)];
  const r = {};
  for (const qu of q.questions) {
    if (!qu.obligatoire && hasard() < 0.3) continue;
    const options = optionsDe(qu, data);
    if (qu.type === 'texte') r[qu.id] = hasard() < 0.2 ? '   ' : `Texte ${Math.floor(hasard() * 1000)}`;
    else if (qu.type === 'choix_multiple') r[qu.id] = options.filter(() => hasard() < 0.4);
    else r[qu.id] = choisir(options);
    if (precisionSi(qu, data).length && hasard() < 0.7) r[qu.id + '_precision'] = 'Précision';
  }
  // Champs obligatoires de type choix multiple : au moins une case.
  for (const qu of q.questions) {
    if (qu.obligatoire && qu.type === 'choix_multiple' && !r[qu.id]?.length) r[qu.id] = [optionsDe(qu, data)[0]];
  }
  return r;
}

for (const cle of Object.keys(data.questionnaires)) {
  test(`parité front / script : ${cle}`, () => {
    const q = data.questionnaires[cle];
    const hasard = aleatoire(2026);
    for (let i = 0; i < 300; i++) {
      const reponses = tirerReponses(q, hasard);
      const etapesValides = themesVisibles(q, reponses).every((t) => !Object.keys(erreursTheme(q, data, t.id, reponses)).length);
      assert.ok(etapesValides, 'le tirage doit produire des réponses valides');

      const payload = construirePayload(data, cle, reponses, { id: `test-${cle}-${i}-abcdef` });
      const v = gs.validerReponse_(JSON.parse(JSON.stringify(payload)), data);
      assert.equal(v.ok, true, `tirage ${i} refusé : ${v.erreur}`);
      assert.deepEqual(Object.keys(v.reponse.valeurs).sort(), Object.keys(payload.reponses).sort(), `tirage ${i}`);
    }
  });
}
