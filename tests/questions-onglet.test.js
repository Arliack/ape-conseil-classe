// Construction du questionnaire à partir de l'onglet « Questions » (construireQuestionnaire_ de Code.gs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chargerAppsScript, questionnaireExemple } from './outils.js';
import { niveauDe, optionsDe } from '../src/lib/questionnaire.js';

const gs = chargerAppsScript();
const brut = (x) => JSON.parse(JSON.stringify(x));
const TYPES = ['echelle4', 'choix_unique', 'choix_multiple', 'texte'];

// Une ligne de l'onglet : [Masquer, Thème, Question, Type, Réponses, Obligatoire, Précisez si, Afficher si, Niveaux, Aide, Libellé précision, Max, Identifiant]
const ligne = (theme, question, type, options = '', extra = {}) => {
  const l = [false, theme, question, type, options, false, '', '', '', '', '', '', ''];
  for (const [col, v] of Object.entries(extra)) l[gs.COL[col]] = v;
  return l;
};
const construire = (lignes) => brut(gs.construireQuestionnaire_(lignes, gs.configDepart_(), 'v-test'));

test('les questions de départ se publient sans erreur', () => {
  const res = construire(gs.QUESTIONS_DEPART);
  assert.deepEqual(res.erreurs, []);
  const q = res.data.questionnaires.parents;
  assert.equal(q.questions[0].id, 'classe');
  assert.equal(q.questions[1].id, 'nom');
  assert.equal(q.questions[1].nominatif, true);
  assert.equal(q.themes[0].titre, 'Votre enfant');
  assert.deepEqual(res.ids, brut(gs.QUESTIONS_DEPART.map((l) => l[gs.COL.ID])), 'identifiants de départ conservés');
});

test('src/dev/questionnaire-exemple.json est à jour (sinon : npm run exemple)', () => {
  const fichier = JSON.parse(readFileSync(new URL('../src/dev/questionnaire-exemple.json', import.meta.url), 'utf8'));
  assert.deepEqual(fichier, questionnaireExemple());
});

test('structure du questionnaire publié', () => {
  const data = questionnaireExemple();
  const q = data.questionnaires.parents;
  const niveaux = new Set(data.listes.classes.map(niveauDe));
  assert.deepEqual(data.echelle4, ['Très bien', 'Bien', 'Moyen', 'Pas bien']);
  for (const c of data.listes.classes) assert.match(c, /^[3-6]e \S+$/);
  const ids = q.questions.map((x) => x.id);
  assert.equal(new Set(ids).size, ids.length, 'identifiants uniques');
  for (const th of q.themes) assert.ok(q.questions.some((x) => x.theme === th.id), `thème vide : ${th.titre}`);
  q.questions.forEach((qu, i) => {
    assert.match(qu.id, /^[a-z][a-z0-9_]*$/);
    assert.ok(TYPES.includes(qu.type));
    assert.ok(q.themes.some((t) => t.id === qu.theme));
    for (const o of optionsDe(qu, data)) assert.ok(!o.includes(';'));
    if (qu.afficher_si?.question) assert.ok(ids.slice(0, i).includes(qu.afficher_si.question));
    if (qu.afficher_si?.niveau) for (const n of qu.afficher_si.niveau) assert.ok(niveaux.has(n));
    for (const n of qu.niveaux || []) assert.ok(niveaux.has(n));
  });
});

test('identifiants fabriqués, stables et uniques', () => {
  assert.equal(gs.identifiant_("L'intégration de votre enfant"), 'l_integration_de_votre_enfant');
  assert.equal(gs.identifiant_('2 langues ?'), 'q_2_langues');
  assert.equal(gs.identifiant_('Avec précision'), 'avec_precision_q');
  const res = construire([
    ligne('Cantine', 'La cantine', 'Échelle 4 niveaux'),
    ligne('Cantine', 'La cantine', 'Échelle 4 niveaux'),
    ligne('Cantine', 'Nom', 'Texte'),
  ]);
  assert.deepEqual(res.erreurs, []);
  assert.deepEqual(res.ids, ['la_cantine', 'la_cantine_2', 'nom_2']);
});

test('identifiant saisi à la main avec accents ou espaces : remis en forme', () => {
  const res = construire([
    ligne('Collège', 'Le collège', 'Échelle 4 niveaux', '', { ID: 'collège' }),
    ligne('Collège', 'Le midi', 'Échelle 4 niveaux', '', { ID: 'Temps méridien' }),
  ]);
  assert.deepEqual(res.erreurs, []);
  assert.deepEqual(res.ids, ['college', 'temps_meridien']);
  assert.deepEqual(res.data.questionnaires.parents.questions.slice(2).map((q) => q.id), ['college', 'temps_meridien']);
  assert.match(construire([ligne('A', 'Q1', 'Texte', '', { ID: 'Collège' }), ligne('A', 'Q2', 'Texte', '', { ID: 'college' })]).erreurs[0], /déjà utilisé/);
});

test('réponses possibles, listes, précision, condition, masquage', () => {
  const res = construire([
    ligne('Scolarité', 'Des difficultés ?', 'Choix unique', 'Non ; Oui', { OBLIGATOIRE: true, ID: 'diff' }),
    ligne('Scolarité', 'Lesquelles ?', 'Choix multiple', '[Matières]', { AFFICHER_SI: 'diff = Oui' }),
    ligne('Scolarité', 'Par libellé', 'Texte court', '', { AFFICHER_SI: 'des difficultés ? = Oui', MAX: 200 }),
    ligne('Orientation', 'Orientation', 'Échelle 4 niveaux', '', { AFFICHER_SI: 'niveau = 4e ; 3e', PRECISION_SI: 'aucune' }),
    ligne('Divers', 'Masquée', 'Texte', '', { MASQUER: true }),
    ligne('Divers', '', 'Texte'),
  ]);
  assert.deepEqual(res.erreurs, []);
  const qs = res.data.questionnaires.parents.questions.slice(2);
  assert.equal(qs.length, 4, 'ligne masquée et ligne vide ignorées');
  assert.deepEqual(qs[0].options, ['Non', 'Oui']);
  assert.equal(qs[0].obligatoire, true);
  assert.equal(qs[1].liste, 'matieres');
  assert.deepEqual(qs[1].afficher_si, { question: 'diff', valeurs: ['Oui'] });
  assert.deepEqual(qs[2].afficher_si, { question: 'diff', valeurs: ['Oui'] });
  assert.equal(qs[2].court, true);
  assert.equal(qs[2].max, 200);
  assert.deepEqual(qs[3].afficher_si, { niveau: ['4e', '3e'] });
  assert.deepEqual(qs[3].precision_si, []);
  assert.equal(res.ids[4], '', 'pas d\'identifiant pour une ligne masquée sans identifiant');
});

test('colonne Niveaux', () => {
  const res = construire([
    ligne('Orientation', 'Le stage de 3e', 'Texte', '', { NIVEAUX: '3e' }),
    ligne('Orientation', 'L\'orientation', 'Échelle 4 niveaux', '', { NIVEAUX: '4e ; 3e' }),
    ligne('Orientation', 'Variante', 'Texte', '', { NIVEAUX: '4e et 3e' }),
    ligne('Divers', 'Tous', 'Texte', '', { NIVEAUX: '6e ; 5e ; 4e ; 3e' }),
  ]);
  assert.deepEqual(res.erreurs, []);
  const qs = res.data.questionnaires.parents.questions.slice(2);
  assert.deepEqual(qs[0].niveaux, ['3e']);
  assert.deepEqual(qs[1].niveaux, ['4e', '3e']);
  assert.deepEqual(qs[2].niveaux, ['4e', '3e']);
  assert.equal(qs[3].niveaux, undefined, 'tous les niveaux = pas de filtre');
  assert.match(construire([ligne('A', 'Q', 'Texte', '', { NIVEAUX: '2nde' })]).erreurs[0], /niveau « 2nde » inconnu \(niveaux des classes : 6e, 5e, 4e, 3e\)/);
});

test('erreurs signalées avec le numéro de ligne', () => {
  const erreurs = (lignes) => construire(lignes).erreurs.join('\n');
  assert.match(erreurs([ligne('A', 'Q', 'Curseur')]), /Ligne 2 : type « Curseur » inconnu/);
  assert.match(erreurs([ligne('', 'Q', 'Texte')]), /Ligne 2 : thème manquant/);
  assert.match(erreurs([ligne('A', 'Q', 'Choix unique', 'Oui')]), /au moins 2 réponses/);
  assert.match(erreurs([ligne('A', 'Q', 'Choix unique', 'Oui ; Oui')]), /en double/);
  assert.match(erreurs([ligne('A', 'Q', 'Choix unique', 'Non ; Oui', { PRECISION_SI: 'Peut-être' })]), /« Peut-être » ne fait pas partie/);
  assert.match(erreurs([ligne('A', 'Q', 'Texte', '', { PRECISION_SI: 'Oui' })]), /inutile pour un texte/);
  assert.match(erreurs([ligne('A', 'Q', 'Texte', '', { AFFICHER_SI: 'inconnue = Oui' })]), /aucune question « inconnue » placée avant/);
  assert.match(erreurs([ligne('A', 'Q', 'Texte', '', { AFFICHER_SI: 'n importe quoi' })]), /doit ressembler/);
  assert.match(erreurs([ligne('A', 'Q', 'Texte', '', { MAX: 5000 })]), /max caractères/);
  assert.match(erreurs([ligne('A', 'Q', 'Texte', '', { ID: 'classe' })]), /réservé/);
  assert.match(erreurs([ligne('A', 'Q1', 'Texte', '', { ID: 'x' }), ligne('A', 'Q2', 'Texte', '', { ID: 'x' })]), /Ligne 3 : identifiant « x » déjà utilisé/);
  assert.match(erreurs([ligne('A', 'Q', 'Choix unique', 'Non ; Oui'), ligne('A', 'R', 'Texte', '', { AFFICHER_SI: 'q = Peut-être' })]), /n'est pas une réponse possible/);
  assert.match(erreurs([]), /Aucune question/);
});
