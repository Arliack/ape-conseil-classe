// Fonctions pures de apps-script/Code.gs, exécutées dans une VM Node (sans services Google).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chargerAppsScript, chargerDonnees } from './outils.js';

const gs = chargerAppsScript();
const data = chargerDonnees();
// Les objets créés dans la VM ont leur propre prototype : on les ramène en objets ordinaires
// pour que deepEqual compare seulement les valeurs.
const brut = (x) => JSON.parse(JSON.stringify(x));

function reponseEleve(modifs = {}) {
  return {
    questionnaire: 'eleves',
    version: data.version,
    id: '0b6c7f7e-6a1d-4c39-9c39-7b1d0d4f1a10',
    site: '',
    reponses: {
      classe: '6e A',
      nom: 'Camille Martin',
      ambiance_classe: 'Bien',
      relations_autres_classes: 'Très bien',
      relations_adultes: 'Bien',
      securite: 'Très bien',
      emploi_du_temps: 'Moyen',
      emploi_du_temps_precision: 'Trop de trous le mardi',
      temps_devoirs: '30 min à 1 h',
      frequence_controles: 'Bien',
      fatigue: 'Pas bien',
      comprehension: 'Bien',
      temps_midi: 'Bien',
      numerique: 'Très bien',
      transport: ['À pied'],
      trajet: 'Bien',
      ...modifs,
    },
  };
}

test('doGet ne renvoie qu’un statut', () => {
  assert.deepEqual(JSON.parse(gs.doGet().texte), { status: 'ok' });
});

test('parserRequete_', () => {
  assert.equal(gs.parserRequete_(undefined).ok, false);
  assert.equal(gs.parserRequete_('').ok, false);
  assert.equal(gs.parserRequete_('pas du json').erreur, 'Requête invalide.');
  assert.equal(gs.parserRequete_('[1,2]').ok, false);
  assert.equal(gs.parserRequete_('x'.repeat(gs.MAX_PAYLOAD + 1)).erreur, 'Réponse trop volumineuse.');
  assert.deepEqual(brut(gs.parserRequete_('{"site":"http://spam"}')), { ok: true, robot: true });
  const p = gs.parserRequete_(JSON.stringify(reponseEleve()));
  assert.equal(p.ok, true);
  assert.equal(p.robot, undefined);
  assert.equal(p.payload.reponses.classe, '6e A');
});

test('validerReponse_ accepte une réponse complète et la met en forme', () => {
  const v = gs.validerReponse_(reponseEleve({ matieres_aise: ['Français', 'EPS'] }), data);
  assert.equal(v.ok, true, v.erreur);
  const val = v.reponse.valeurs;
  assert.equal(val.classe, '6e A');
  assert.equal(val.nom, 'Camille Martin');
  assert.equal(val.matieres_aise, 'Français ; EPS');
  assert.equal(val.emploi_du_temps_precision, 'Trop de trous le mardi');
  assert.equal(v.reponse.version, data.version);
});

test('validerReponse_ refuse ce qui ne va pas', () => {
  const cas = [
    [{ questionnaire: 'profs' }, 'Questionnaire inconnu.'],
    [{ id: 'court' }, 'Identifiant de réponse invalide.'],
    [{ reponses: [] }, 'Réponses manquantes.'],
  ];
  for (const [modif, erreur] of cas) {
    assert.equal(gs.validerReponse_({ ...reponseEleve(), ...modif }, data).erreur, erreur);
  }
  const ko = (modifs) => gs.validerReponse_(reponseEleve(modifs), data);
  assert.match(ko({ classe: '' }).erreur, /Ta classe.*obligatoire/);
  assert.match(ko({ classe: '7e Z' }).erreur, /invalide/);
  assert.match(ko({ ambiance_classe: 'Moyennement' }).erreur, /invalide/);
  assert.match(ko({ securite: undefined }).erreur, /obligatoire/);
  assert.match(ko({ transport: 'À pied' }).erreur, /invalide/, 'choix multiple : liste attendue');
  assert.match(ko({ transport: ['À pied', 'À pied'] }).erreur, /invalide/, 'pas de doublon');
  assert.match(ko({ transport: ['Fusée'] }).erreur, /invalide/);
  assert.match(ko({ a_garder: 'x'.repeat(301) }).erreur, /trop long/);
  assert.match(ko({ emploi_du_temps_precision: 'x'.repeat(501) }).erreur, /trop longue/);
  assert.match(ko({ a_garder: 42 }).erreur, /invalide/);
});

test('validerReponse_ ignore les questions masquées et les précisions non déclenchées', () => {
  const r = reponseEleve({
    orientation_info: 'Pas bien',
    orientation_inquietudes: 'Le lycée',
    ambiance_classe_precision: 'ne doit pas être gardé (réponse « Bien »)',
    champ_inconnu: 'ignoré',
  });
  const en6e = gs.validerReponse_(r, data).reponse.valeurs;
  assert.equal(en6e.orientation_info, undefined, 'orientation masquée en 6e');
  assert.equal(en6e.orientation_inquietudes, undefined);
  assert.equal(en6e.ambiance_classe_precision, undefined);
  assert.equal(en6e.champ_inconnu, undefined);

  r.reponses.classe = '3e B';
  const en3e = gs.validerReponse_(r, data).reponse.valeurs;
  assert.equal(en3e.orientation_info, 'Pas bien');
  assert.equal(en3e.orientation_inquietudes, 'Le lycée');
});

test('validerReponse_ : question conditionnée par une autre (parents)', () => {
  const base = {
    questionnaire: 'parents', version: data.version, id: 'abcdefgh-1234', site: '',
    reponses: {
      classe: '5e B', integration: 'Bien', emploi_du_temps: 'Bien', travail_maison: 'Bien',
      forme_motivation: 'Bien', communication: 'Bien', difficultes: 'Non',
      difficultes_matieres: ['Mathématiques'],
    },
  };
  assert.equal(gs.validerReponse_(base, data).reponse.valeurs.difficultes_matieres, undefined);
  base.reponses.difficultes = 'Oui';
  assert.equal(gs.validerReponse_(base, data).reponse.valeurs.difficultes_matieres, 'Mathématiques');
});

test('neutraliserFormule_ : aucun texte ne devient formule, nombre ou date', () => {
  assert.equal(gs.neutraliserFormule_('=IMPORTXML("http://x")'), '\'=IMPORTXML("http://x")');
  assert.equal(gs.neutraliserFormule_('+33 6 00'), "'+33 6 00");
  assert.equal(gs.neutraliserFormule_('-'), "'-");
  assert.equal(gs.neutraliserFormule_('@moi'), "'@moi");
  assert.equal(gs.neutraliserFormule_('10/12'), "'10/12");
  assert.equal(gs.neutraliserFormule_('2026-11-01'), "'2026-11-01");
  assert.equal(gs.neutraliserFormule_('Tout va bien'), 'Tout va bien');
  const v = gs.validerReponse_(reponseEleve({ idee: '=1+1' }), data);
  assert.equal(v.reponse.valeurs.idee, "'=1+1");
});

test('colonnesAttendues_ : colonnes fixes, questions, précisions', () => {
  const cols = brut(gs.colonnesAttendues_(data.questionnaires.eleves, data).map((c) => c.id));
  assert.deepEqual(cols.slice(0, 5), ['horodatage', 'id_reponse', 'version', 'classe', 'nom']);
  assert.ok(cols.includes('ambiance_classe_precision'));
  assert.ok(cols.includes('harcelement_precision'));
  assert.ok(!cols.includes('temps_devoirs_precision'), 'pas de précision sans precision_si');
  assert.equal(new Set(cols).size, cols.length);
});

test('calculerSynthese_ : répartition, points « Pas bien », commentaires sans nom', () => {
  const lignes = [
    { classe: '6e A', nom: 'Alice Secret', ambiance_classe: 'Pas bien', ambiance_classe_precision: 'Bruit', securite: 'Pas bien', fatigue: 'Pas bien', transport: 'À pied ; Voiture', a_garder: 'Le CDI' },
    { classe: '6e A', nom: 'Bob Secret', ambiance_classe: 'Pas bien', securite: 'Bien', fatigue: 'Très bien', transport: 'Voiture', a_garder: 'Les clubs' },
    { classe: '6e A', ambiance_classe: 'Bien', securite: 'Bien', transport: 'Transport scolaire' },
    { classe: '5e B', ambiance_classe: 'Très bien' },
  ];
  const synthese = gs.calculerSynthese_(data, { eleves: lignes, parents: [] });
  const sixA = synthese.find((s) => s.classe === '6e A');
  const el = sixA.questionnaires.eleves;
  assert.equal(sixA.total, 3);
  assert.equal(el.n, 3);

  const ambiance = el.themes.find((t) => t.titre === 'Vie de classe').echelles.find((e) => e.libelle.startsWith("L'ambiance"));
  assert.deepEqual(brut(ambiance.effectifs), [0, 1, 0, 2]);
  assert.equal(ambiance.n, 3);

  assert.equal(el.pasBien[0].libelle, "L'ambiance dans ta classe");
  assert.equal(el.pasBien[0].n, 2);
  assert.equal(el.pasBien.length, 3);

  const transport = el.themes.find((t) => t.titre === 'Vie au collège').choix.find((c) => c.libelle.startsWith('Comment'));
  assert.equal(transport.n, 3);
  assert.equal(transport.effectifs.find((o) => o.option === 'Voiture').n, 2);

  const garder = el.commentaires.find((c) => c.libelle === 'Une chose à garder au collège');
  assert.deepEqual(brut(garder.textes), ['Le CDI', 'Les clubs']);
  assert.ok(el.commentaires.some((c) => c.textes.includes('(Pas bien) Bruit')));

  const tout = JSON.stringify(brut(synthese)) + JSON.stringify(brut(gs.lignesSyntheseClasse_(sixA, data, 'aujourd’hui')));
  assert.ok(!tout.includes('Secret'), 'aucun nom dans la synthèse');

  const vue = brut(gs.lignesVueEnsemble_(synthese, data, 'aujourd’hui'));
  assert.ok(vue.some((l) => l.v[0] === '6e A' && l.v[1] === 3 && l.v[3] === 'Synthese 6e A'));
  assert.ok(vue.some((l) => l.v[0] === '4e A' && l.v[3] === '(aucune réponse)'));
});

test('lettreColonne_', () => {
  assert.equal(gs.lettreColonne_(1), 'A');
  assert.equal(gs.lettreColonne_(26), 'Z');
  assert.equal(gs.lettreColonne_(27), 'AA');
});
