/**
 * @OnlyCurrentDoc  Le script n'a accès qu'à ce classeur, pas aux autres fichiers du Drive.
 *
 * Questionnaire « conseil de classe » (parents) — APE du collège Raymond Queneau.
 *
 * Les questions se modifient dans l'onglet « Questions », puis menu APE > Publier les questions.
 * Application web liée à ce classeur :
 *   GET                      → { status: "ok" }
 *   GET ?action=questionnaire → les questions publiées (jamais les réponses)
 *   POST (JSON envoyé en text/plain, sans requête CORS préalable) → enregistre une réponse
 */

var ONGLETS = {
  CONFIG: 'Config',
  QUESTIONS: 'Questions',
  REPONSES: 'Reponses_Parents',
  SYNTHESE: 'Synthese',
  PREFIXE_CLASSE: 'Synthese '   // un onglet « Synthese 6e A » par classe
};
var CLE = 'parents';             // nom du questionnaire dans les données et le payload

var ECHELLE = ['Très bien', 'Bien', 'Moyen', 'Pas bien'];
var PRECISION_ECHELLE = ['Moyen', 'Pas bien'];   // « Précisez » par défaut pour une échelle

var MAX_PAYLOAD = 30000;        // caractères ; au-delà la requête est rejetée
var MAX_TEXTE_DEFAUT = 1000;    // si la question ne précise pas de maximum
var MAX_PRECISION = 500;
var SUFFIXE_PRECISION = '_precision';
var SEPARATEUR_MULTIPLE = ' ; ';
var CACHE_CLE = 'questionnaire';
var CACHE_DUREE = 21600;        // 6 h, le maximum de CacheService
var NB_POINTS_PAS_BIEN = 5;

var COLONNES_FIXES = [
  { id: 'horodatage', libelle: 'Date et heure de la réponse' },
  { id: 'id_reponse', libelle: 'Identifiant technique (évite les doublons en cas de renvoi)' },
  { id: 'version', libelle: 'Version des questions utilisée' }
];
var IDS_RESERVES = ['horodatage', 'id_reponse', 'version', 'classe', 'nom', 'site'];

/* ========================================================================== */
/* Onglet « Questions » : une ligne par question                               */
/* ========================================================================== */

var COL = {
  MASQUER: 0, THEME: 1, QUESTION: 2, TYPE: 3, OPTIONS: 4, OBLIGATOIRE: 5,
  PRECISION_SI: 6, AFFICHER_SI: 7, AIDE: 8, LIBELLE_PRECISION: 9, MAX: 10, ID: 11
};
var ENTETES_QUESTIONS = [
  ['Masquer', 'Cocher pour retirer la question du formulaire sans perdre sa colonne de réponses.'],
  ['Thème', 'Chaque thème est une étape du formulaire, dans l\'ordre d\'apparition.'],
  ['Question', 'Texte affiché aux parents.'],
  ['Type', 'Échelle 4 niveaux (Très bien / Bien / Moyen / Pas bien), Choix unique, Choix multiple, Texte (plusieurs lignes) ou Texte court (une ligne).'],
  ['Réponses possibles', 'Pour les choix : réponses séparées par « ; ». [Classes] ou [Matières] reprennent les listes de l\'onglet Config. Inutile pour une échelle ou un texte.'],
  ['Obligatoire', 'Cocher si la question doit avoir une réponse.'],
  ['Précisez si', 'Réponses (séparées par « ; ») qui font apparaître un champ « Précisez ». Vide sur une échelle = Moyen ; Pas bien. Écrire « aucune » pour ne jamais l\'afficher.'],
  ['Afficher si', 'Condition d\'affichage, par exemple : difficultes = Oui (identifiant d\'une question placée avant = réponse(s) séparées par « ; »). Vide = toujours affichée.'],
  ['Aide', 'Petite phrase d\'aide sous la question (facultatif).'],
  ['Libellé de « Précisez »', 'Remplace le libellé du champ de précision pour cette question (facultatif).'],
  ['Max caractères', 'Longueur maximale d\'un texte (1000 par défaut).'],
  ['Identifiant', 'Rempli automatiquement à la publication. C\'est le nom de la colonne dans Reponses_Parents : ne pas le modifier une fois des réponses reçues.']
];
var TYPES = {
  'échelle 4 niveaux': { type: 'echelle4' },
  'choix unique': { type: 'choix_unique' },
  'choix multiple': { type: 'choix_multiple' },
  'texte': { type: 'texte' },
  'texte court': { type: 'texte', court: true }
};
var LISTES = { '[classes]': 'classes', '[matières]': 'matieres', '[matieres]': 'matieres' };

/** Questions installées au départ (modifiables ensuite dans l'onglet). */
var QUESTIONS_DEPART = [
  [false, 'Intégration', "L'intégration de votre enfant dans sa classe", 'Échelle 4 niveaux', '', true, '', '', '', '', '', 'integration'],
  [false, 'Rythme', 'Son emploi du temps', 'Échelle 4 niveaux', '', true, '', '', '', '', '', 'emploi_du_temps'],
  [false, 'Rythme', 'Le travail à la maison (rythme, quantité)', 'Échelle 4 niveaux', '', true, '', '', '', '', '', 'travail_maison'],
  [false, 'Rythme', 'Sa forme et sa motivation, telles que vous les observez à la maison', 'Échelle 4 niveaux', '', true, '', '', '', '', '', 'forme_motivation'],
  [false, 'Absences', "Le rattrapage des cours en cas d'absence", 'Échelle 4 niveaux', '', false, '', '', "Laissez vide si votre enfant n'a pas été absent.", '', '', 'rattrapage_absence'],
  [false, 'Depuis la rentrée', 'Y a-t-il eu des éléments exceptionnels depuis la rentrée (incident, changement, événement familial…) ?', 'Choix unique', 'Non ; Oui', false, 'Oui', '', 'Dites seulement ce qui est utile au conseil de classe. Évitez les informations de santé détaillées.', '', '', 'evenements_exceptionnels'],
  [false, 'Scolarité', 'Votre enfant rencontre-t-il des difficultés dans certaines matières ?', 'Choix unique', 'Non ; Oui', true, '', '', '', '', '', 'difficultes'],
  [false, 'Scolarité', 'Lesquelles ?', 'Choix multiple', '[Matières]', false, '', 'difficultes = Oui', '', '', '', 'difficultes_matieres'],
  [false, 'Scolarité', 'Avez-vous rencontré les professeurs concernés ou le professeur principal ?', 'Choix unique', 'Oui, les professeurs concernés ; Oui, le professeur principal ; Oui, les deux ; Pas encore', false, '', 'difficultes = Oui', '', '', '', 'rencontre_profs'],
  [false, 'Scolarité', 'Votre enfant a-t-il un soutien scolaire (au collège ou à l\'extérieur) ?', 'Choix unique', 'Non ; Oui', false, 'Oui', '', '', 'Lequel ?', '', 'soutien_scolaire'],
  [false, 'Communication', 'La communication avec le collège (Pronote, mails, réunions)', 'Échelle 4 niveaux', '', true, '', '', '', '', '', 'communication'],
  [false, 'Autres sujets', 'Transports, cantine, autres sujets : vos remarques', 'Texte', '', false, '', '', '', '', 1000, 'autres_sujets'],
  [false, 'Pour finir', 'Une chose à garder', 'Texte court', '', false, '', '', '', '', 300, 'a_garder'],
  [false, 'Pour finir', 'Une chose à changer', 'Texte court', '', false, '', '', '', '', 300, 'a_changer'],
  [false, 'Pour finir', 'Une suggestion', 'Texte court', '', false, '', '', '', '', 300, 'suggestion']
];

/* Onglet « Config » : paramètres (colonnes A-B) et listes Classes / Matières (colonnes D-E). */

var PARAMS = {
  TITRE: 'Titre du questionnaire',
  INTRO: 'Introduction (accueil)',
  ENFANT: 'Texte de la 1re étape',
  PRECISION: 'Libellé du champ « Précisez »',
  MERCI: 'Message de remerciement',
  PROCHAIN: 'Prochain conseil de classe',
  CONTACT: "Contact de l'APE",
  CONSERVATION: 'Conservation des réponses',
  VERSION: 'Version publiée (automatique)',
  PUBLIE_LE: 'Publiée le (automatique)'
};
var PARAMS_DEPART = [
  [PARAMS.TITRE, 'Questionnaire parents'],
  [PARAMS.INTRO, 'Vos réponses sont lues par les délégués de parents pour préparer le conseil de classe. Le nom de votre enfant est facultatif et n\'apparaît jamais dans la synthèse.'],
  [PARAMS.ENFANT, 'Si vous avez plusieurs enfants au collège, répondez pour le premier : vous pourrez ensuite répondre pour un autre enfant.'],
  [PARAMS.PRECISION, 'Précisez si vous le souhaitez'],
  [PARAMS.MERCI, 'Merci pour vos réponses ! Les délégués de parents vont les lire pour préparer le conseil de classe.'],
  [PARAMS.PROCHAIN, 'Les conseils de classe du 1er trimestre ont lieu en décembre 2026 (dates à confirmer).'],
  [PARAMS.CONTACT, 'ape.queneau@gmail.com'],
  [PARAMS.CONSERVATION, "Les réponses sont supprimées à la fin de l'année scolaire, au plus tard le 31 août 2027."],
  [PARAMS.VERSION, ''],
  [PARAMS.PUBLIE_LE, '']
];
var CLASSES_DEPART = ['6e A', '6e B', '6e C', '6e D', '5e A', '5e B', '5e C', '4e A', '4e B', '4e C', '4e D', '3e A', '3e B', '3e C'];
var MATIERES_DEPART = ['Français', 'Mathématiques', 'Histoire-géographie / EMC', 'Anglais', 'LV2 (espagnol, allemand…)', 'SVT',
  'Physique-chimie', 'Technologie', 'Arts plastiques', 'Éducation musicale', 'EPS', 'Latin'];

function configDepart_() {
  var params = {};
  PARAMS_DEPART.forEach(function (p) { params[p[0]] = p[1]; });
  return { params: params, classes: CLASSES_DEPART.slice(), matieres: MATIERES_DEPART.slice() };
}

/* ========================================================================== */
/* Application web                                                             */
/* ========================================================================== */

function doGet(e) {
  if (e && e.parameter && e.parameter.action === 'questionnaire') {
    var data = lireQuestionnairePublie_();
    return json_(data ? { ok: true, data: data } : { ok: false, erreur: "Le questionnaire n'est pas encore publié." });
  }
  return json_({ status: 'ok' });
}

function doPost(e) {
  try {
    var p = parserRequete_(e && e.postData && e.postData.contents);
    if (!p.ok) return json_({ ok: false, erreur: p.erreur });
    // Champ piège rempli : un robot. On fait semblant d'accepter, sans rien écrire.
    if (p.robot) return json_({ ok: true });

    var data = lireQuestionnairePublie_();
    if (!data) return json_({ ok: false, erreur: "Le questionnaire n'est pas encore publié." });
    var v = validerReponse_(p.payload, data);
    if (!v.ok) {
      var aRecharger = p.payload.version && p.payload.version !== data.version;
      return json_({ ok: false, erreur: v.erreur + (aRecharger ? ' Le questionnaire vient d\'être modifié : rechargez la page, vos réponses sont gardées.' : '') });
    }

    var lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      var doublon = enregistrerReponse_(v.reponse, data);
      return json_({ ok: true, doublon: doublon });
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    console.error(err);
    return json_({ ok: false, erreur: 'Erreur du serveur. Réessayez dans un instant.' });
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/* ========================================================================== */
/* Construction du questionnaire depuis l'onglet (fonction pure, testée)       */
/* ========================================================================== */

/**
 * Transforme les lignes de l'onglet « Questions » et les réglages de Config en questionnaire.
 * @param {Array[]} lignes  valeurs de l'onglet, sans la ligne d'en-tête
 * @param {{params:Object, classes:string[], matieres:string[]}} config
 * @return {{erreurs:string[], ids:string[], data:Object}} ids[i] = identifiant de la ligne i ('' si ignorée)
 */
function construireQuestionnaire_(lignes, config, version) {
  var erreurs = [];
  var ids = lignes.map(function (l) { return String(l[COL.ID] || '').trim(); });
  var pris = IDS_RESERVES.slice();
  ids.forEach(function (id) { if (id) pris.push(id); });
  var listes = { classes: config.classes, matieres: config.matieres };
  var themes = [{ id: 'enfant', titre: 'Votre enfant', intro: config.params[PARAMS.ENFANT] || '' }];
  var questions = [
    { id: 'classe', theme: 'enfant', type: 'choix_unique', libelle: 'Classe de votre enfant', obligatoire: true, liste: 'classes', affichage: 'liste' },
    { id: 'nom', theme: 'enfant', type: 'texte', libelle: 'Nom et prénom de votre enfant (facultatif)', obligatoire: false, nominatif: true, max: 80, court: true }
  ];
  var dejaVus = {};

  lignes.forEach(function (l, i) {
    var n = 'Ligne ' + (i + 2) + ' : ';
    var libelle = String(l[COL.QUESTION] || '').trim();
    if (!libelle || l[COL.MASQUER] === true) return;

    var defType = TYPES[String(l[COL.TYPE] || '').trim().toLowerCase()];
    if (!defType) { erreurs.push(n + 'type « ' + l[COL.TYPE] + ' » inconnu.'); return; }
    var titreTheme = String(l[COL.THEME] || '').trim();
    if (!titreTheme) { erreurs.push(n + 'thème manquant.'); return; }

    // Identifiant : celui de la colonne L, sinon fabriqué à partir de la question.
    var id = ids[i];
    if (id && !/^[a-z][a-z0-9_]*$/.test(id)) { erreurs.push(n + 'identifiant « ' + id + ' » invalide (minuscules, chiffres et _).'); return; }
    if (id && (dejaVus[id] || IDS_RESERVES.indexOf(id) !== -1 || /_precision$/.test(id))) {
      erreurs.push(n + 'identifiant « ' + id + ' » déjà utilisé ou réservé.'); return;
    }
    if (!id) {
      var base = identifiant_(libelle);
      id = base;
      for (var k = 2; pris.indexOf(id) !== -1; k++) id = base + '_' + k;
      pris.push(id);
      ids[i] = id;
    }
    dejaVus[id] = true;

    var q = { id: id, theme: '', type: defType.type, libelle: libelle, obligatoire: l[COL.OBLIGATOIRE] === true };
    if (defType.court) q.court = true;

    var options = [];
    var brutOptions = String(l[COL.OPTIONS] || '').trim();
    if (q.type === 'choix_unique' || q.type === 'choix_multiple') {
      var liste = LISTES[brutOptions.toLowerCase()];
      if (liste) {
        q.liste = liste;
        options = listes[liste];
      } else {
        options = decouper_(brutOptions);
        q.options = options;
      }
      if (options.length < 2) { erreurs.push(n + 'au moins 2 réponses possibles, séparées par « ; ».'); return; }
      if (options.some(function (o, j) { return options.indexOf(o) !== j; })) { erreurs.push(n + 'réponse possible en double.'); return; }
    } else if (q.type === 'echelle4') {
      options = ECHELLE;
    }

    var brutPrecision = String(l[COL.PRECISION_SI] || '').trim();
    if (brutPrecision) {
      if (q.type === 'texte') { erreurs.push(n + '« Précisez si » est inutile pour un texte.'); return; }
      q.precision_si = brutPrecision.toLowerCase() === 'aucune' ? [] : decouper_(brutPrecision);
      var inconnue = q.precision_si.filter(function (v) { return options.indexOf(v) === -1; })[0];
      if (inconnue) { erreurs.push(n + '« Précisez si » : « ' + inconnue + ' » ne fait pas partie des réponses possibles.'); return; }
    }

    var brutCondition = String(l[COL.AFFICHER_SI] || '').trim();
    if (brutCondition) {
      var m = /^([^=]+?)\s*=\s*(.+)$/.exec(brutCondition);
      if (!m) { erreurs.push(n + '« Afficher si » doit ressembler à : difficultes = Oui'); return; }
      var ref = m[1].trim();
      var valeurs = decouper_(m[2]);
      if (ref.toLowerCase() === 'niveau') {
        q.afficher_si = { niveau: valeurs };
      } else {
        var cible = questions.filter(function (x) { return x.id === ref || x.libelle.toLowerCase() === ref.toLowerCase(); })[0];
        if (!cible) { erreurs.push(n + '« Afficher si » : aucune question « ' + ref + ' » placée avant.'); return; }
        var optsCible = optionsDe_(cible, { echelle4: ECHELLE, listes: listes });
        var horsListe = valeurs.filter(function (v) { return optsCible.indexOf(v) === -1; })[0];
        if (horsListe) { erreurs.push(n + '« Afficher si » : « ' + horsListe + ' » n\'est pas une réponse possible de « ' + cible.libelle + ' ».'); return; }
        q.afficher_si = { question: cible.id, valeurs: valeurs };
      }
    }

    var aide = String(l[COL.AIDE] || '').trim();
    if (aide) q.aide = aide;
    var libP = String(l[COL.LIBELLE_PRECISION] || '').trim();
    if (libP) q.precision_libelle = libP;
    if (l[COL.MAX] !== '' && l[COL.MAX] !== null && l[COL.MAX] !== undefined) {
      var max = Number(l[COL.MAX]);
      if (!(max >= 1 && max <= 2000 && Math.floor(max) === max)) { erreurs.push(n + 'max caractères entre 1 et 2000.'); return; }
      if (q.type === 'texte') q.max = max;
    }

    var theme = themes.filter(function (t) { return t.titre.toLowerCase() === titreTheme.toLowerCase(); })[0];
    if (!theme) {
      var idTheme = identifiant_(titreTheme);
      while (themes.some(function (t) { return t.id === idTheme; })) idTheme += '_';
      theme = { id: idTheme, titre: titreTheme };
      themes.push(theme);
    }
    q.theme = theme.id;
    questions.push(q);
  });

  if (!config.classes.length) erreurs.push('Onglet Config : la liste des classes (colonne D) est vide.');
  if (questions.length <= 2) erreurs.push('Aucune question à afficher.');

  var p = config.params;
  return {
    erreurs: erreurs,
    ids: ids,
    data: {
      version: String(version || ''),
      site: {
        association: 'APE du collège Raymond Queneau',
        college: 'Collège Raymond Queneau',
        contact: p[PARAMS.CONTACT] || '',
        prochain_conseil: p[PARAMS.PROCHAIN] || '',
        conservation: p[PARAMS.CONSERVATION] || ''
      },
      echelle4: ECHELLE,
      precision_echelle4: PRECISION_ECHELLE,
      listes: listes,
      questionnaires: {
        parents: {
          titre: p[PARAMS.TITRE] || 'Questionnaire parents',
          intro: p[PARAMS.INTRO] || '',
          precision_libelle: p[PARAMS.PRECISION] || 'Précisez si vous le souhaitez',
          merci: p[PARAMS.MERCI] || 'Merci pour vos réponses !',
          themes: themes,
          questions: questions
        }
      }
    }
  };
}

function decouper_(txt) {
  return String(txt || '').split(/\s*[;\n]\s*/).map(function (s) { return s.trim(); }).filter(Boolean);
}

/** « L'intégration de votre enfant » → « l_integration_de_votre_enfant ». */
function identifiant_(texte) {
  var id = String(texte).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40).replace(/_+$/, '');
  if (!id) id = 'question';
  if (!/^[a-z]/.test(id)) id = 'q_' + id;
  if (/_precision$/.test(id)) id += '_q';
  return id;
}

/* ========================================================================== */
/* Lecture et validation d'une réponse (fonctions pures, testées)              */
/* ========================================================================== */

/**
 * Lit le corps brut de la requête.
 * @return {{ok:boolean, erreur?:string, robot?:boolean, payload?:Object}}
 */
function parserRequete_(brut) {
  if (typeof brut !== 'string' || brut === '') return { ok: false, erreur: 'Requête vide.' };
  if (brut.length > MAX_PAYLOAD) return { ok: false, erreur: 'Réponse trop volumineuse.' };
  var payload;
  try {
    payload = JSON.parse(brut);
  } catch (_) {
    return { ok: false, erreur: 'Requête invalide.' };
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return { ok: false, erreur: 'Requête invalide.' };
  if (typeof payload.site === 'string' && payload.site.trim() !== '') return { ok: true, robot: true };
  return { ok: true, payload: payload };
}

/**
 * Vérifie une réponse au regard du questionnaire publié et la met en forme pour le Sheet.
 * Les questions masquées (condition non remplie) sont ignorées, les clés inconnues aussi.
 * @return {{ok:true, reponse:{questionnaire, id, version, valeurs}} | {ok:false, erreur:string}}
 */
function validerReponse_(payload, data) {
  var KO = function (msg) { return { ok: false, erreur: msg }; };
  var a = function (o, k) { return Object.prototype.hasOwnProperty.call(o, k); };

  var cle = payload.questionnaire;
  if (typeof cle !== 'string' || !a(data.questionnaires, cle)) return KO('Questionnaire inconnu.');
  var q = data.questionnaires[cle];

  if (typeof payload.id !== 'string' || !/^[A-Za-z0-9-]{8,64}$/.test(payload.id)) return KO('Identifiant de réponse invalide.');

  var rep = payload.reponses;
  if (!rep || typeof rep !== 'object' || Array.isArray(rep)) return KO('Réponses manquantes.');

  var valeurs = {};
  for (var i = 0; i < q.questions.length; i++) {
    var question = q.questions[i];
    if (!questionVisible_(q, question, rep)) continue;

    var val = a(rep, question.id) ? rep[question.id] : null;
    var nom = '« ' + question.libelle + ' »';
    if (estVide_(val)) {
      if (question.obligatoire) return KO('La question ' + nom + ' est obligatoire.');
      continue;
    }

    var options = optionsDe_(question, data);
    if (question.type === 'echelle4' || question.type === 'choix_unique') {
      if (typeof val !== 'string' || options.indexOf(val) === -1) return KO('Réponse invalide pour ' + nom + '.');
      valeurs[question.id] = val;
    } else if (question.type === 'choix_multiple') {
      if (!Array.isArray(val) || val.length > options.length) return KO('Réponse invalide pour ' + nom + '.');
      for (var j = 0; j < val.length; j++) {
        if (typeof val[j] !== 'string' || options.indexOf(val[j]) === -1 || val.indexOf(val[j]) !== j) {
          return KO('Réponse invalide pour ' + nom + '.');
        }
      }
      valeurs[question.id] = val.join(SEPARATEUR_MULTIPLE);
    } else if (question.type === 'texte') {
      var max = question.max || MAX_TEXTE_DEFAUT;
      if (typeof val !== 'string') return KO('Réponse invalide pour ' + nom + '.');
      val = nettoyerTexte_(val);
      if (val.length > max) return KO('Texte trop long pour ' + nom + ' (' + max + ' caractères maximum).');
      if (val) valeurs[question.id] = neutraliserFormule_(val);
    } else {
      return KO('Type de question inconnu : ' + question.type + '.');
    }

    var cleP = question.id + SUFFIXE_PRECISION;
    if (precisionVisible_(question, val, data) && a(rep, cleP) && !estVide_(rep[cleP])) {
      if (typeof rep[cleP] !== 'string') return KO('Précision invalide pour ' + nom + '.');
      var precision = nettoyerTexte_(rep[cleP]);
      if (precision.length > MAX_PRECISION) return KO('Précision trop longue pour ' + nom + ' (' + MAX_PRECISION + ' caractères maximum).');
      valeurs[cleP] = neutraliserFormule_(precision);
    }
  }

  if (!valeurs.classe) return KO('Indiquez la classe.');
  return { ok: true, reponse: { questionnaire: cle, id: payload.id, version: String(data.version || ''), valeurs: valeurs } };
}

function nettoyerTexte_(txt) {
  return String(txt).replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, '').trim();
}

/**
 * Empêche Google Sheets d'interpréter un texte libre : formule (= + - @) ou nombre/date
 * (« 10/12 » deviendrait une date). L'apostrophe de tête est invisible dans le Sheet.
 */
function neutraliserFormule_(txt) {
  return /^[=+\-@]/.test(txt) || /^[\d\s.,\/:%-]+$/.test(txt) ? "'" + txt : txt;
}

function estVide_(v) {
  if (Array.isArray(v)) return v.length === 0;
  return v === undefined || v === null || String(v).trim() === '';
}

/* Règles d'affichage : les mêmes que src/lib/questionnaire.js (voir tests/parite.test.js). */

function optionsDe_(question, data) {
  if (question.type === 'echelle4') return data.echelle4;
  if (question.liste) return data.listes[question.liste] || [];
  return question.options || [];
}

function precisionSi_(question, data) {
  if (Array.isArray(question.precision_si)) return question.precision_si;
  if (question.type === 'echelle4') return data.precision_echelle4 || [];
  return [];
}

function niveauDe_(classe) {
  return String(classe || '').trim().split(/\s+/)[0];
}

function enListe_(v) {
  if (Array.isArray(v)) return v;
  return v === undefined || v === null || v === '' ? [] : [v];
}

function croise_(valeur, valeurs) {
  return enListe_(valeur).some(function (v) { return valeurs.indexOf(v) !== -1; });
}

function conditionRemplie_(si, rep) {
  if (!si) return true;
  if (si.niveau) return si.niveau.indexOf(niveauDe_(rep.classe)) !== -1;
  if (si.question) return croise_(rep[si.question], si.valeurs || []);
  return true;
}

function questionVisible_(q, question, rep) {
  var theme = q.themes.filter(function (t) { return t.id === question.theme; })[0];
  return conditionRemplie_(theme && theme.afficher_si, rep) && conditionRemplie_(question.afficher_si, rep);
}

function precisionVisible_(question, valeur, data) {
  return croise_(valeur, precisionSi_(question, data));
}

/** Colonnes attendues dans l'onglet de réponses : fixes, puis chaque question suivie de sa précision. */
function colonnesAttendues_(q, data) {
  var cols = COLONNES_FIXES.slice();
  q.questions.forEach(function (question) {
    var theme = q.themes.filter(function (t) { return t.id === question.theme; })[0];
    var prefixe = theme ? theme.titre + ' — ' : '';
    cols.push({ id: question.id, libelle: prefixe + question.libelle });
    if (precisionSi_(question, data).length) {
      cols.push({ id: question.id + SUFFIXE_PRECISION, libelle: prefixe + question.libelle + ' (précision)' });
    }
  });
  return cols;
}

/* ========================================================================== */
/* Questionnaire publié                                                        */
/* ========================================================================== */

/** Le questionnaire publié, ou null. Gardé dans les propriétés du script (par morceaux) et en cache. */
function lireQuestionnairePublie_() {
  var cache = CacheService.getScriptCache();
  var txt = cache.get(CACHE_CLE);
  if (!txt) {
    var props = PropertiesService.getScriptProperties();
    var nb = parseInt(props.getProperty('QUESTIONNAIRE_NB') || '0', 10);
    if (!nb) return null;
    var morceaux = [];
    for (var i = 0; i < nb; i++) morceaux.push(props.getProperty('QUESTIONNAIRE_' + i) || '');
    txt = morceaux.join('');
    cache.put(CACHE_CLE, txt, CACHE_DUREE);
  }
  return lireJson_(txt);
}

function sauverPublication_(data) {
  var txt = JSON.stringify(data);
  var obj = {};
  var nb = 0;
  // Une propriété est limitée à 9 Ko : on découpe large (2500 caractères, accents compris).
  for (var i = 0; i < txt.length; i += 2500) obj['QUESTIONNAIRE_' + nb++] = txt.slice(i, i + 2500);
  obj.QUESTIONNAIRE_NB = String(nb);
  PropertiesService.getScriptProperties().setProperties(obj, false);
  CacheService.getScriptCache().put(CACHE_CLE, txt, CACHE_DUREE);
}

function lireJson_(txt) {
  if (!txt) return null;
  try { return JSON.parse(txt); } catch (_) { return null; }
}

function lireConfig_(ss) {
  var sh = ss.getSheetByName(ONGLETS.CONFIG);
  var params = {};
  var classes = [];
  var matieres = [];
  if (sh && sh.getLastRow() > 1) {
    var v = sh.getRange(2, 1, sh.getLastRow() - 1, 5).getValues();
    v.forEach(function (l) {
      if (String(l[0]).trim()) params[String(l[0]).trim()] = String(l[1]).trim();
      if (String(l[3]).trim()) classes.push(String(l[3]).trim());
      if (String(l[4]).trim()) matieres.push(String(l[4]).trim());
    });
  }
  return { params: params, classes: classes, matieres: matieres };
}

/* ========================================================================== */
/* Enregistrement                                                              */
/* ========================================================================== */

/**
 * Crée l'onglet si besoin et ajoute à droite les colonnes manquantes. Les colonnes existantes ne
 * sont jamais supprimées ni déplacées : l'APE peut les réordonner, le script les retrouve par leur id.
 */
function assurerOngletReponses_(ss, data) {
  var sh = ss.getSheetByName(ONGLETS.REPONSES) || ss.insertSheet(ONGLETS.REPONSES);
  var nbCol = sh.getLastColumn();
  var entetes = nbCol ? sh.getRange(1, 1, 1, nbCol).getValues()[0].map(String) : [];
  var manquantes = colonnesAttendues_(data.questionnaires[CLE], data).filter(function (c) {
    return entetes.indexOf(c.id) === -1;
  });
  if (manquantes.length) {
    var debut = nbCol + 1;
    if (sh.getMaxColumns() < nbCol + manquantes.length) sh.insertColumnsAfter(sh.getMaxColumns(), nbCol + manquantes.length - sh.getMaxColumns());
    var plage = sh.getRange(1, debut, 1, manquantes.length);
    plage.setValues([manquantes.map(function (c) { return c.id; })]);
    plage.setNotes([manquantes.map(function (c) { return c.libelle; })]);
    plage.setFontWeight('bold').setBackground('#eef6f8');
    sh.setFrozenRows(1);
    entetes = entetes.concat(manquantes.map(function (c) { return c.id; }));
  }
  return { sheet: sh, entetes: entetes };
}

/**
 * Ajoute la ligne. À appeler sous verrou. Idempotent sur l'identifiant de réponse : un renvoi
 * (coupure réseau, double clic) ne crée pas de doublon.
 * @return {boolean} true si la réponse était déjà enregistrée.
 */
function enregistrerReponse_(r, data) {
  var o = assurerOngletReponses_(SpreadsheetApp.getActiveSpreadsheet(), data);
  var sh = o.sheet;
  var colId = o.entetes.indexOf('id_reponse') + 1;
  var derniere = sh.getLastRow();
  if (derniere > 1) {
    var ids = sh.getRange(2, colId, derniere - 1, 1).getValues();
    for (var i = 0; i < ids.length; i++) if (ids[i][0] === r.id) return true;
  }
  var valeurs = Object.assign({
    horodatage: new Date(),
    id_reponse: neutraliserFormule_(r.id),     // reste du texte même s'il ne contient que des chiffres
    version: neutraliserFormule_(r.version)    // une date-heure ne doit pas être convertie
  }, r.valeurs);
  var ligne = o.entetes.map(function (h) {
    return Object.prototype.hasOwnProperty.call(valeurs, h) ? valeurs[h] : '';
  });
  sh.getRange(derniere + 1, 1, 1, ligne.length).setValues([ligne]);
  return false;
}

/* ========================================================================== */
/* Menu du Sheet                                                               */
/* ========================================================================== */

function onOpen() {
  SpreadsheetApp.getUi().createMenu('APE')
    .addItem('Publier les questions', 'publierQuestions')
    .addItem('Mettre à jour la synthèse', 'buildSynthese')
    .addSeparator()
    .addItem('Installer / réparer le classeur', 'installer')
    .addToUi();
}

/**
 * Menu APE > Publier les questions : vérifie l'onglet « Questions », complète les identifiants,
 * et met en ligne la nouvelle version (le formulaire la charge à l'ouverture suivante).
 */
function publierQuestions() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(ONGLETS.QUESTIONS);
  if (!sh) throw new Error('Onglet « Questions » introuvable : lancer APE > Installer / réparer le classeur.');
  var nb = Math.max(sh.getLastRow() - 1, 0);
  var lignes = nb ? sh.getRange(2, 1, nb, ENTETES_QUESTIONS.length).getValues() : [];
  var version = Utilities.formatDate(new Date(), 'Europe/Paris', "yyyy-MM-dd'T'HH:mm:ss");
  var res = construireQuestionnaire_(lignes, lireConfig_(ss), version);

  if (res.erreurs.length) {
    SpreadsheetApp.getUi().alert('Questions non publiées',
      'Corrigez ces points dans l\'onglet Questions puis relancez APE > Publier les questions :\n\n' + res.erreurs.join('\n'),
      SpreadsheetApp.getUi().ButtonSet.OK);
    return;
  }
  if (nb) sh.getRange(2, COL.ID + 1, nb, 1).setValues(res.ids.map(function (id) { return [id]; }));
  sauverPublication_(res.data);
  assurerOngletReponses_(ss, res.data);
  ecrireParam_(ss, PARAMS.VERSION, version);
  ecrireParam_(ss, PARAMS.PUBLIE_LE, new Date());
  ss.toast(res.data.questionnaires[CLE].questions.length + ' questions en ligne (version ' + version + ').', 'Questions publiées', 8);
}

function ecrireParam_(ss, nom, valeur) {
  var sh = ss.getSheetByName(ONGLETS.CONFIG);
  var noms = sh.getRange(1, 1, sh.getLastRow(), 1).getValues().map(function (l) { return String(l[0]).trim(); });
  var k = noms.indexOf(nom);
  if (k === -1) {
    k = noms.length;
    sh.getRange(k + 1, 1).setValue(nom);
  }
  sh.getRange(k + 1, 2).setValue(typeof valeur === 'string' ? neutraliserFormule_(valeur) : valeur);
}

/** Crée ce qui manque (onglets, en-têtes, listes déroulantes) sans écraser ce qui existe, puis publie. */
function installer() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  assurerOngletConfig_(ss);
  assurerOngletQuestions_(ss);
  if (!ss.getSheetByName(ONGLETS.SYNTHESE)) ss.insertSheet(ONGLETS.SYNTHESE);

  // Restes d'une version précédente ou du classeur vide de départ.
  ['Reponses_Eleves', 'Feuille 1', 'Sheet1'].forEach(function (nom) {
    var sh = ss.getSheetByName(nom);
    if (sh && sh.getLastRow() <= 1 && ss.getSheets().length > 1) ss.deleteSheet(sh);
  });
  ss.setActiveSheet(ss.getSheetByName(ONGLETS.QUESTIONS));
  publierQuestions();
}

function assurerOngletConfig_(ss) {
  var sh = ss.getSheetByName(ONGLETS.CONFIG);
  // Ancienne mise en page (adresse du fichier questionnaires.json) : remplacée.
  if (sh && String(sh.getRange('A2').getValue()).indexOf('URL du questionnaire') === 0) {
    ss.deleteSheet(sh);
    sh = null;
  }
  if (sh) return sh;
  sh = ss.insertSheet(ONGLETS.CONFIG);
  sh.getRange(1, 1, 1, 5).setValues([['Paramètre', 'Valeur', '', 'Classes', 'Matières']]).setFontWeight('bold');
  sh.getRange(2, 1, PARAMS_DEPART.length, 2).setValues(PARAMS_DEPART);
  sh.getRange(2, 4, CLASSES_DEPART.length, 1).setValues(CLASSES_DEPART.map(function (c) { return [c]; }));
  sh.getRange(2, 5, MATIERES_DEPART.length, 1).setValues(MATIERES_DEPART.map(function (m) { return [m]; }));
  sh.getRange(2, 2, PARAMS_DEPART.length, 1).setWrap(true);
  sh.setColumnWidth(1, 240);
  sh.setColumnWidth(2, 420);
  sh.setColumnWidth(3, 24);
  sh.setColumnWidth(4, 100);
  sh.setColumnWidth(5, 200);
  sh.setFrozenRows(1);
  sh.getRange('A1').setNote('Modifiez les valeurs, les classes (format « 6e A ») et les matières, puis APE > Publier les questions.');
  return sh;
}

function assurerOngletQuestions_(ss) {
  var sh = ss.getSheetByName(ONGLETS.QUESTIONS);
  if (sh) return sh;
  sh = ss.insertSheet(ONGLETS.QUESTIONS, 0);
  var nbCol = ENTETES_QUESTIONS.length;
  var entete = sh.getRange(1, 1, 1, nbCol);
  entete.setValues([ENTETES_QUESTIONS.map(function (e) { return e[0]; })])
    .setNotes([ENTETES_QUESTIONS.map(function (e) { return e[1]; })])
    .setFontWeight('bold').setBackground('#eef6f8').setVerticalAlignment('middle');
  var lignes = sh.getMaxRows() - 1;
  sh.getRange(2, COL.MASQUER + 1, lignes, 1).insertCheckboxes();
  sh.getRange(2, COL.OBLIGATOIRE + 1, lignes, 1).insertCheckboxes();
  sh.getRange(2, COL.TYPE + 1, lignes, 1).setDataValidation(SpreadsheetApp.newDataValidation()
    .requireValueInList(['Échelle 4 niveaux', 'Choix unique', 'Choix multiple', 'Texte', 'Texte court'], true)
    .setAllowInvalid(false).build());
  // Après insertCheckboxes (qui met toutes les cases à faux), pour garder les cases cochées de départ.
  sh.getRange(2, 1, QUESTIONS_DEPART.length, nbCol).setValues(QUESTIONS_DEPART);

  sh.getRange(2, 1, lignes, nbCol).setVerticalAlignment('top').setWrap(true);
  sh.getRange(2, COL.ID + 1, lignes, 1).setFontColor('#4a5560');
  [70, 140, 360, 140, 260, 90, 120, 170, 240, 160, 90, 170].forEach(function (w, i) { sh.setColumnWidth(i + 1, w); });
  sh.setFrozenRows(1);
  return sh;
}

/* ========================================================================== */
/* Synthèse pour les délégués                                                  */
/* ========================================================================== */

/**
 * Menu APE > Mettre à jour la synthèse. Recrée l'onglet « Synthese » (vue d'ensemble) et un onglet
 * « Synthese <classe> » par classe ayant au moins une réponse. Les noms n'y figurent jamais.
 */
function buildSynthese() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var data = lireQuestionnairePublie_();
  if (!data) throw new Error('Questions pas encore publiées : APE > Publier les questions.');
  var lignesParQ = {};
  lignesParQ[CLE] = lireReponses_(ss.getSheetByName(ONGLETS.REPONSES));
  var synthese = calculerSynthese_(data, lignesParQ);
  var maintenant = Utilities.formatDate(new Date(), ss.getSpreadsheetTimeZone(), "dd/MM/yyyy 'à' HH:mm");

  ss.getSheets().forEach(function (sh) {
    if (sh.getName().indexOf(ONGLETS.PREFIXE_CLASSE) === 0) ss.deleteSheet(sh);
  });

  var vue = ss.getSheetByName(ONGLETS.SYNTHESE) || ss.insertSheet(ONGLETS.SYNTHESE);
  ecrireTableau_(vue, lignesVueEnsemble_(synthese, data, maintenant), [380, 140, 220]);

  synthese.forEach(function (resClasse) {
    if (!resClasse.total) return;
    var sh = ss.insertSheet(ONGLETS.PREFIXE_CLASSE + resClasse.classe);
    ecrireTableau_(sh, lignesSyntheseClasse_(resClasse, data, maintenant), [380, 80, 80, 80, 80, 80]);
  });
  ss.setActiveSheet(vue);
  ss.toast('Synthèse mise à jour.', 'APE', 5);
}

/** Lignes de l'onglet de réponses → objets { id: valeur }. */
function lireReponses_(sh) {
  if (!sh || sh.getLastRow() < 2) return [];
  var valeurs = sh.getDataRange().getValues();
  var entetes = valeurs[0].map(String);
  return valeurs.slice(1).map(function (ligne) {
    var o = {};
    entetes.forEach(function (h, i) { o[h] = ligne[i]; });
    return o;
  });
}

/** Calcul de la synthèse, par classe puis par questionnaire. Fonction pure. */
function calculerSynthese_(data, lignesParQ) {
  var classes = data.listes.classes.slice();
  Object.keys(lignesParQ).forEach(function (cle) {
    lignesParQ[cle].forEach(function (l) {
      var c = String(l.classe || '').trim();
      if (c && classes.indexOf(c) === -1) classes.push(c);   // classe retirée de la liste depuis
    });
  });
  return classes.map(function (classe) {
    var res = { classe: classe, total: 0, questionnaires: {} };
    Object.keys(data.questionnaires).forEach(function (cle) {
      var lignes = (lignesParQ[cle] || []).filter(function (l) { return String(l.classe || '').trim() === classe; });
      res.questionnaires[cle] = synthetiserQuestionnaire_(data, data.questionnaires[cle], lignes);
      res.total += lignes.length;
    });
    return res;
  });
}

function synthetiserQuestionnaire_(data, q, lignes) {
  var echelle = data.echelle4;
  var pire = echelle.length - 1;
  var themes = [];
  var pasBien = [];
  var commentaires = [];

  q.themes.forEach(function (t) {
    var bloc = { titre: t.titre, echelles: [], choix: [] };
    q.questions.forEach(function (qu) {
      if (qu.theme !== t.id || qu.nominatif || qu.id === 'classe') return;

      if (qu.type === 'echelle4') {
        var eff = echelle.map(function () { return 0; });
        lignes.forEach(function (l) {
          var k = echelle.indexOf(String(l[qu.id]));
          if (k !== -1) eff[k]++;
        });
        var n = eff.reduce(function (s, x) { return s + x; }, 0);
        bloc.echelles.push({ libelle: qu.libelle, effectifs: eff, n: n });
        if (eff[pire] > 0) pasBien.push({ libelle: qu.libelle, theme: t.titre, n: eff[pire], sur: n });
      } else if (qu.type === 'choix_unique' || qu.type === 'choix_multiple') {
        var options = optionsDe_(qu, data).slice();
        var compte = {};
        var repondants = 0;
        lignes.forEach(function (l) {
          var vals = qu.type === 'choix_multiple' ? String(l[qu.id] || '').split(SEPARATEUR_MULTIPLE) : [String(l[qu.id] || '')];
          vals = vals.map(function (v) { return v.trim(); }).filter(Boolean);
          if (vals.length) repondants++;
          vals.forEach(function (v) {
            if (options.indexOf(v) === -1) options.push(v);   // option retirée depuis
            compte[v] = (compte[v] || 0) + 1;
          });
        });
        bloc.choix.push({
          libelle: qu.libelle,
          multiple: qu.type === 'choix_multiple',
          n: repondants,
          effectifs: options.map(function (o) { return { option: o, n: compte[o] || 0 }; })
        });
      }

      // Textes libres et précisions, triés par ordre alphabétique : l'ordre d'arrivée
      // ne permet pas de relier entre elles les réponses d'une même personne.
      var textes = [];
      lignes.forEach(function (l) {
        if (qu.type === 'texte' && !estVide_(l[qu.id])) textes.push(String(l[qu.id]).trim());
        var p = l[qu.id + SUFFIXE_PRECISION];
        if (qu.type !== 'texte' && !estVide_(p)) textes.push('(' + String(l[qu.id]) + ') ' + String(p).trim());
      });
      if (textes.length) {
        textes.sort(function (x, y) { return x.localeCompare(y, 'fr'); });
        commentaires.push({ theme: t.titre, libelle: qu.libelle, textes: textes });
      }
    });
    if (bloc.echelles.length || bloc.choix.length) themes.push(bloc);
  });

  pasBien.sort(function (x, y) { return y.n - x.n || y.n / (y.sur || 1) - x.n / (x.sur || 1); });
  return { n: lignes.length, themes: themes, pasBien: pasBien.slice(0, NB_POINTS_PAS_BIEN), commentaires: commentaires };
}

/* Mise en page : une liste de { v: [cellules], s: style }, écrite d'un bloc par ecrireTableau_. */

function lignesVueEnsemble_(synthese, data, maintenant) {
  var L = [
    { v: ['Synthèse du questionnaire · conseil de classe'], s: 'titre' },
    { v: ['Mise à jour le ' + maintenant + ' (menu APE > Mettre à jour la synthèse)'], s: 'note' },
    { v: ['Les noms ne figurent jamais dans la synthèse. Relisez les commentaires avant de les présenter : ils peuvent contenir des détails qui identifient quelqu\'un.'], s: 'note' },
    { v: [''], s: '' },
    { v: ['Classe', 'Réponses', 'Onglet'], s: 'entete' }
  ];
  synthese.forEach(function (r) {
    L.push({ v: [r.classe, r.total, r.total ? ONGLETS.PREFIXE_CLASSE + r.classe : '(aucune réponse)'], s: 'ligne' });
  });
  return L;
}

function lignesSyntheseClasse_(r, data, maintenant) {
  var echelle = data.echelle4;
  var L = [
    { v: ['Synthèse ' + r.classe + ' · conseil de classe'], s: 'titre' },
    { v: [r.total + ' réponse(s) · mise à jour le ' + maintenant], s: 'note' }
  ];

  Object.keys(data.questionnaires).forEach(function (cle) {
    var s = r.questionnaires[cle];
    if (!s.n) return;

    if (s.pasBien.length) {
      L.push({ v: [''], s: '' });
      L.push({ v: ['Points « ' + echelle[echelle.length - 1] + ' » les plus cités'], s: 'theme' });
      L.push({ v: ['Question', 'Nombre', '% des réponses', '', '', 'Réponses'], s: 'entete' });
      s.pasBien.forEach(function (p) {
        L.push({ v: [p.libelle + ' (' + p.theme + ')', p.n, p.sur ? p.n / p.sur : 0, '', '', p.sur], s: 'pct-c' });
      });
    }

    s.themes.forEach(function (t) {
      L.push({ v: [t.titre], s: 'theme' });
      if (t.echelles.length) {
        L.push({ v: ['Question'].concat(echelle).concat(['Réponses']), s: 'entete' });
        t.echelles.forEach(function (e) {
          L.push({ v: [e.libelle].concat(e.effectifs.map(function (x) { return e.n ? x / e.n : 0; })).concat([e.n]), s: 'pct-be' });
        });
      }
      t.choix.forEach(function (c) {
        L.push({ v: [c.libelle + (c.multiple ? ' (plusieurs réponses possibles)' : ''), 'Nombre', '% des répondants', '', '', 'Répondants'], s: 'entete' });
        c.effectifs.forEach(function (o) {
          L.push({ v: ['    ' + o.option, o.n, c.n ? o.n / c.n : 0, '', '', c.n], s: 'pct-c' });
        });
      });
    });

    if (s.commentaires.length) {
      L.push({ v: ['Commentaires (sans les noms, par ordre alphabétique)'], s: 'theme' });
      s.commentaires.forEach(function (c) {
        L.push({ v: [c.theme + ' · ' + c.libelle], s: 'sous-titre' });
        c.textes.forEach(function (t) { L.push({ v: ['« ' + t + ' »'], s: 'commentaire' }); });
      });
    }
  });
  return L;
}

/** Écrit les lignes d'un coup, puis applique la mise en forme par groupes de lignes. */
function ecrireTableau_(sh, lignes, largeurs) {
  var nbCol = largeurs.length;
  sh.clear();
  sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns()).breakApart();
  var valeurs = lignes.map(function (l) {
    var v = l.v.map(function (x) { return typeof x === 'string' ? neutraliserFormule_(x) : x; });
    while (v.length < nbCol) v.push('');
    return v.slice(0, nbCol);
  });
  if (sh.getMaxRows() < valeurs.length) sh.insertRowsAfter(sh.getMaxRows(), valeurs.length - sh.getMaxRows());
  sh.getRange(1, 1, valeurs.length, nbCol).setValues(valeurs).setVerticalAlignment('top').setWrap(true)
    .setFontFamily('Arial').setFontSize(10);
  largeurs.forEach(function (w, i) { sh.setColumnWidth(i + 1, w); });
  sh.setHiddenGridlines(true);

  var der = lettreColonne_(nbCol);
  var parStyle = {};
  lignes.forEach(function (l, i) { (parStyle[l.s] = parStyle[l.s] || []).push(i + 1); });
  // appliquer('theme', 'A:F', f) → f(RangeList 'A5:F5', 'A9:F9', …) pour toutes les lignes du style.
  var appliquer = function (style, colonnes, f) {
    var p = (parStyle[style] || []).map(function (n) {
      return colonnes.split(':').map(function (c) { return c + n; }).join(':');
    });
    if (p.length) f(sh.getRangeList(p));
  };

  appliquer('titre', 'A', function (rl) { rl.setFontSize(16).setFontWeight('bold'); });
  appliquer('note', 'A', function (rl) { rl.setFontColor('#4a5560'); });
  appliquer('theme', 'A:' + der, function (rl) { rl.setFontSize(11).setFontWeight('bold').setBackground('#eef6f8'); });
  appliquer('entete', 'A:' + der, function (rl) { rl.setFontWeight('bold').setFontColor('#4a5560'); });
  appliquer('sous-titre', 'A', function (rl) { rl.setFontWeight('bold'); });
  appliquer('pct-be', 'B:E', function (rl) { rl.setNumberFormat('0%'); });
  appliquer('pct-c', 'C', function (rl) { rl.setNumberFormat('0%'); });

  // Titres, notes et commentaires sur toute la largeur (pour l'impression),
  // fusionnés par blocs de lignes consécutives pour limiter les appels.
  var aFusionner = ['titre', 'note', 'theme', 'sous-titre', 'commentaire'];
  var debut = 0;
  for (var n = 1; n <= lignes.length + 1; n++) {
    var fusion = n <= lignes.length && aFusionner.indexOf(lignes[n - 1].s) !== -1;
    if (fusion && !debut) debut = n;
    if (!fusion && debut) {
      sh.getRange(debut, 1, n - debut, nbCol).mergeAcross();
      debut = 0;
    }
  }
}

/** Numéro de colonne (1-based) → lettre(s) : 1 → A, 27 → AA. */
function lettreColonne_(n) {
  var s = '';
  while (n > 0) {
    var r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}
