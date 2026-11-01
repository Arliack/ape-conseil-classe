// Validation de src/data/questionnaires.json : à lancer après chaque modification des questions.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chargerDonnees } from './outils.js';
import { niveauDe, optionsDe } from '../src/lib/questionnaire.js';

const data = chargerDonnees();
const TYPES = ['echelle4', 'choix_unique', 'choix_multiple', 'texte'];
const COLONNES_RESERVEES = ['horodatage', 'id_reponse', 'version'];

test('en-tête du fichier', () => {
  assert.equal(typeof data.version, 'string');
  assert.ok(data.version, '"version" ne doit pas être vide');
  assert.deepEqual(data.echelle4, ['Très bien', 'Bien', 'Moyen', 'Pas bien']);
  assert.deepEqual(data.precision_echelle4, ['Moyen', 'Pas bien']);
  for (const champ of ['contact', 'conservation']) assert.ok(data.site[champ], `site.${champ} manquant`);
});

test('listes : classes et matières', () => {
  const { classes, matieres } = data.listes;
  assert.ok(classes.length > 0);
  assert.equal(new Set(classes).size, classes.length, 'classe en double');
  for (const c of classes) assert.match(c, /^[3-6]e \S+$/, `classe « ${c} » : format attendu « 6e A »`);
  assert.equal(new Set(matieres).size, matieres.length, 'matière en double');
});

for (const [cle, q] of Object.entries(data.questionnaires)) {
  test(`questionnaire ${cle}`, async (t) => {
    const idsThemes = q.themes.map((th) => th.id);
    const niveaux = new Set(data.listes.classes.map(niveauDe));

    await t.test('thèmes', () => {
      assert.equal(new Set(idsThemes).size, idsThemes.length, 'id de thème en double');
      for (const th of q.themes) {
        assert.ok(th.titre, `thème ${th.id} sans titre`);
        assert.ok(q.questions.some((qu) => qu.theme === th.id), `thème ${th.id} sans question`);
        if (th.afficher_si?.niveau) for (const n of th.afficher_si.niveau) assert.ok(niveaux.has(n), `niveau inconnu : ${n}`);
      }
      for (const champ of ['titre', 'bouton_accueil', 'intro', 'precision_libelle', 'merci']) assert.ok(q[champ], `${champ} manquant`);
    });

    await t.test('questions', () => {
      const vus = new Set();
      q.questions.forEach((qu, i) => {
        const ici = `${cle}.${qu.id}`;
        assert.match(qu.id, /^[a-z][a-z0-9_]*$/, `${ici} : id en minuscules, chiffres et _ uniquement`);
        assert.ok(!vus.has(qu.id), `${ici} : id en double`);
        assert.ok(!qu.id.endsWith('_precision'), `${ici} : un id ne peut pas finir par _precision`);
        assert.ok(!COLONNES_RESERVEES.includes(qu.id), `${ici} : id réservé`);
        assert.ok(idsThemes.includes(qu.theme), `${ici} : thème « ${qu.theme} » inconnu`);
        assert.ok(TYPES.includes(qu.type), `${ici} : type « ${qu.type} » inconnu`);
        assert.equal(typeof qu.libelle, 'string');
        assert.ok(qu.libelle.trim(), `${ici} : libellé vide`);
        assert.equal(typeof qu.obligatoire, 'boolean', `${ici} : "obligatoire" doit valoir true ou false`);

        const options = optionsDe(qu, data);
        if (qu.type === 'choix_unique' || qu.type === 'choix_multiple') {
          if (qu.liste) assert.ok(data.listes[qu.liste], `${ici} : liste « ${qu.liste} » inconnue`);
          else assert.ok(Array.isArray(qu.options) && qu.options.length > 1, `${ici} : au moins 2 options`);
          assert.equal(new Set(options).size, options.length, `${ici} : option en double`);
        }
        for (const o of options) assert.ok(!o.includes(';'), `${ici} : « ; » interdit dans une option (séparateur du Sheet)`);
        if (qu.type === 'texte') {
          if (qu.max !== undefined) assert.ok(Number.isInteger(qu.max) && qu.max > 0 && qu.max <= 2000, `${ici} : max entre 1 et 2000`);
          assert.ok(!qu.precision_si, `${ici} : pas de précision sur un texte`);
        }
        if (qu.precision_si) {
          for (const v of qu.precision_si) assert.ok(options.includes(v), `${ici} : precision_si « ${v} » n'est pas une option`);
        }
        if (qu.aide_si) {
          for (const v of qu.aide_si.valeurs) assert.ok(options.includes(v), `${ici} : aide_si « ${v} » n'est pas une option`);
          assert.ok(qu.aide_si.contacts?.length, `${ici} : aide_si sans contact`);
        }
        if (qu.afficher_si?.question) {
          const ref = q.questions.slice(0, i).find((x) => x.id === qu.afficher_si.question);
          assert.ok(ref, `${ici} : afficher_si doit viser une question placée avant`);
          for (const v of qu.afficher_si.valeurs) assert.ok(optionsDe(ref, data).includes(v), `${ici} : valeur « ${v} » inconnue`);
        }
        if (qu.afficher_si?.niveau) for (const n of qu.afficher_si.niveau) assert.ok(niveaux.has(n), `${ici} : niveau inconnu`);
        if (qu.nominatif) assert.equal(qu.type, 'texte', `${ici} : seul un texte peut être nominatif`);
        vus.add(qu.id);
      });
    });

    await t.test('question « classe » en tête, obligatoire, sur la liste des classes', () => {
      const classe = q.questions[0];
      assert.equal(classe.id, 'classe');
      assert.equal(classe.obligatoire, true);
      assert.equal(classe.liste, 'classes');
      assert.equal(classe.type, 'choix_unique');
    });
  });
}
