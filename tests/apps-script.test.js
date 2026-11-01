// Fonctions pures de apps-script/Code.gs, exécutées dans une VM Node (sans services Google).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chargerAppsScript, questionnaireExemple } from './outils.js';

const gs = chargerAppsScript();
const data = questionnaireExemple();
// Les objets créés dans la VM ont leur propre prototype : on les ramène en objets ordinaires
// pour que deepEqual compare seulement les valeurs.
const brut = (x) => JSON.parse(JSON.stringify(x));

function reponse(modifs = {}) {
  return {
    questionnaire: 'parents',
    version: data.version,
    id: '0b6c7f7e-6a1d-4c39-9c39-7b1d0d4f1a10',
    site: '',
    reponses: {
      classe: '6e A',
      nom: 'Camille Martin',
      integration: 'Bien',
      emploi_du_temps: 'Moyen',
      emploi_du_temps_precision: 'Trop de trous le mardi',
      travail_maison: 'Bien',
      forme_motivation: 'Pas bien',
      difficultes: 'Non',
      communication: 'Très bien',
      ...modifs,
    },
  };
}

test('doGet : statut seul, ou questionnaire publié sur demande', () => {
  assert.deepEqual(JSON.parse(gs.doGet().texte), { status: 'ok' });
  assert.deepEqual(JSON.parse(gs.doGet({ parameter: {} }).texte), { status: 'ok' });
});

test('parserRequete_', () => {
  assert.equal(gs.parserRequete_(undefined).ok, false);
  assert.equal(gs.parserRequete_('').ok, false);
  assert.equal(gs.parserRequete_('pas du json').erreur, 'Requête invalide.');
  assert.equal(gs.parserRequete_('[1,2]').ok, false);
  assert.equal(gs.parserRequete_('x'.repeat(gs.MAX_PAYLOAD + 1)).erreur, 'Réponse trop volumineuse.');
  assert.deepEqual(brut(gs.parserRequete_('{"site":"http://spam"}')), { ok: true, robot: true });
  const p = gs.parserRequete_(JSON.stringify(reponse()));
  assert.equal(p.ok, true);
  assert.equal(p.robot, undefined);
  assert.equal(p.payload.reponses.classe, '6e A');
});

test('validerReponse_ accepte une réponse complète et la met en forme', () => {
  const v = gs.validerReponse_(reponse({ difficultes: 'Oui', difficultes_matieres: ['Français', 'EPS'] }), data);
  assert.equal(v.ok, true, v.erreur);
  const val = v.reponse.valeurs;
  assert.equal(val.classe, '6e A');
  assert.equal(val.nom, 'Camille Martin');
  assert.equal(val.difficultes_matieres, 'Français ; EPS');
  assert.equal(val.emploi_du_temps_precision, 'Trop de trous le mardi');
  assert.equal(v.reponse.version, data.version);
});

test('validerReponse_ refuse ce qui ne va pas', () => {
  const cas = [
    [{ questionnaire: 'eleves' }, 'Questionnaire inconnu.'],
    [{ id: 'court' }, 'Identifiant de réponse invalide.'],
    [{ reponses: [] }, 'Réponses manquantes.'],
  ];
  for (const [modif, erreur] of cas) {
    assert.equal(gs.validerReponse_({ ...reponse(), ...modif }, data).erreur, erreur);
  }
  const ko = (modifs) => gs.validerReponse_(reponse(modifs), data);
  assert.match(ko({ classe: '' }).erreur, /Classe de votre enfant.*obligatoire/);
  assert.match(ko({ classe: '7e Z' }).erreur, /invalide/);
  assert.match(ko({ integration: 'Moyennement' }).erreur, /invalide/);
  assert.match(ko({ communication: undefined }).erreur, /obligatoire/);
  assert.match(ko({ difficultes: 'Oui', difficultes_matieres: 'EPS' }).erreur, /invalide/, 'choix multiple : liste attendue');
  assert.match(ko({ difficultes: 'Oui', difficultes_matieres: ['EPS', 'EPS'] }).erreur, /invalide/, 'pas de doublon');
  assert.match(ko({ difficultes: 'Oui', difficultes_matieres: ['Couture'] }).erreur, /invalide/);
  assert.match(ko({ a_garder: 'x'.repeat(301) }).erreur, /trop long/);
  assert.match(ko({ emploi_du_temps_precision: 'x'.repeat(501) }).erreur, /trop longue/);
  assert.match(ko({ a_garder: 42 }).erreur, /invalide/);
});

test('validerReponse_ ignore les questions masquées et les précisions non déclenchées', () => {
  const val = gs.validerReponse_(reponse({
    difficultes: 'Non',
    difficultes_matieres: ['Mathématiques'],
    integration_precision: 'ne doit pas être gardé (réponse « Bien »)',
    champ_inconnu: 'ignoré',
  }), data).reponse.valeurs;
  assert.equal(val.difficultes_matieres, undefined, 'masquée si pas de difficulté');
  assert.equal(val.integration_precision, undefined);
  assert.equal(val.champ_inconnu, undefined);
});

test('neutraliserFormule_ : aucun texte ne devient formule, nombre ou date', () => {
  assert.equal(gs.neutraliserFormule_('=IMPORTXML("http://x")'), '\'=IMPORTXML("http://x")');
  assert.equal(gs.neutraliserFormule_('+33 6 00'), "'+33 6 00");
  assert.equal(gs.neutraliserFormule_('-'), "'-");
  assert.equal(gs.neutraliserFormule_('@moi'), "'@moi");
  assert.equal(gs.neutraliserFormule_('10/12'), "'10/12");
  assert.equal(gs.neutraliserFormule_('2026-11-01'), "'2026-11-01");
  assert.equal(gs.neutraliserFormule_('Tout va bien'), 'Tout va bien');
  const v = gs.validerReponse_(reponse({ suggestion: '=1+1' }), data);
  assert.equal(v.reponse.valeurs.suggestion, "'=1+1");
});

test('colonnesAttendues_ : colonnes fixes, questions, précisions', () => {
  const cols = brut(gs.colonnesAttendues_(data.questionnaires.parents, data).map((c) => c.id));
  assert.deepEqual(cols.slice(0, 5), ['horodatage', 'id_reponse', 'version', 'classe', 'nom']);
  assert.ok(cols.includes('integration_precision'), 'échelle : précision par défaut');
  assert.ok(cols.includes('soutien_scolaire_precision'));
  assert.ok(!cols.includes('difficultes_precision'), 'pas de précision sans « Précisez si »');
  assert.equal(new Set(cols).size, cols.length);
});

test('calculerSynthese_ : répartition, points « Pas bien », commentaires sans nom', () => {
  const lignes = [
    { classe: '6e A', nom: 'Alice Secret', integration: 'Pas bien', integration_precision: 'Isolée', communication: 'Pas bien', forme_motivation: 'Pas bien', difficultes: 'Oui', difficultes_matieres: 'Français ; EPS', a_garder: 'Le CDI' },
    { classe: '6e A', nom: 'Bob Secret', integration: 'Pas bien', communication: 'Bien', forme_motivation: 'Très bien', difficultes: 'Oui', difficultes_matieres: 'EPS', a_garder: 'Les clubs' },
    { classe: '6e A', integration: 'Bien', communication: 'Bien', difficultes: 'Non' },
    { classe: '5e B', integration: 'Très bien' },
  ];
  const synthese = gs.calculerSynthese_(data, { parents: lignes });
  const sixA = synthese.find((s) => s.classe === '6e A');
  const s = sixA.questionnaires.parents;
  assert.equal(sixA.total, 3);
  assert.equal(s.n, 3);

  const integration = s.themes.find((t) => t.titre === 'Intégration').echelles[0];
  assert.deepEqual(brut(integration.effectifs), [0, 1, 0, 2]);
  assert.equal(integration.n, 3);

  assert.equal(s.pasBien[0].libelle, "L'intégration de votre enfant dans sa classe");
  assert.equal(s.pasBien[0].n, 2);
  assert.equal(s.pasBien.length, 3);

  const matieres = s.themes.find((t) => t.titre === 'Scolarité').choix.find((c) => c.libelle === 'Lesquelles ?');
  assert.equal(matieres.n, 2);
  assert.equal(matieres.effectifs.find((o) => o.option === 'EPS').n, 2);

  const garder = s.commentaires.find((c) => c.libelle === 'Une chose à garder');
  assert.deepEqual(brut(garder.textes), ['Le CDI', 'Les clubs']);
  assert.ok(s.commentaires.some((c) => c.textes.includes('(Pas bien) Isolée')));

  const tout = JSON.stringify(brut(synthese)) + JSON.stringify(brut(gs.lignesSyntheseClasse_(sixA, data, 'aujourd’hui')));
  assert.ok(!tout.includes('Secret'), 'aucun nom dans la synthèse');

  const vue = brut(gs.lignesVueEnsemble_(synthese, data, 'aujourd’hui'));
  assert.ok(vue.some((l) => l.v[0] === '6e A' && l.v[1] === 3 && l.v[2] === 'Synthese 6e A'));
  assert.ok(vue.some((l) => l.v[0] === '4e A' && l.v[2] === '(aucune réponse)'));
});

test('lettreColonne_', () => {
  assert.equal(gs.lettreColonne_(1), 'A');
  assert.equal(gs.lettreColonne_(26), 'Z');
  assert.equal(gs.lettreColonne_(27), 'AA');
});
