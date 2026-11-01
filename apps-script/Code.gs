/**
 * @OnlyCurrentDoc  Le script n'a accès qu'à ce classeur, pas aux autres fichiers du Drive.
 *
 * Questionnaires « conseil de classe » — APE du collège Raymond Queneau.
 *
 * Application web liée au Google Sheet :
 *   GET  → { status: "ok" } et rien d'autre (aucune réponse n'est lisible publiquement)
 *   POST → corps JSON envoyé en text/plain (pas de requête CORS préalable) : enregistre une réponse
 *
 * Les questions ne sont pas écrites ici : le script lit questionnaires.json publié avec le site
 * (adresse dans l'onglet Config, cellule B2). Ajouter une question = modifier ce fichier JSON dans
 * le dépôt ; les colonnes du Sheet se créent toutes seules, sans toucher à ce code.
 */

var ONGLETS = {
  CONFIG: 'Config',
  SYNTHESE: 'Synthese',
  PREFIXE_CLASSE: 'Synthese '   // un onglet « Synthese 6e A » par classe
};
var ONGLETS_REPONSES = { eleves: 'Reponses_Eleves', parents: 'Reponses_Parents' };

var COLONNES_FIXES = [
  { id: 'horodatage', libelle: 'Date et heure de la réponse' },
  { id: 'id_reponse', libelle: 'Identifiant technique (évite les doublons en cas de renvoi)' },
  { id: 'version', libelle: 'Version du questionnaire utilisée' }
];

var MAX_PAYLOAD = 30000;        // caractères ; au-delà la requête est rejetée
var MAX_TEXTE_DEFAUT = 1000;    // si la question ne précise pas "max"
var MAX_PRECISION = 500;
var SUFFIXE_PRECISION = '_precision';
var SEPARATEUR_MULTIPLE = ' ; ';
var CACHE_CLE = 'questionnaires';
var CACHE_DUREE = 21600;        // 6 h, le maximum de CacheService
var NB_POINTS_PAS_BIEN = 5;

// Cellules de l'onglet Config.
var CONFIG = { URL: 'B2', VERSION: 'B3', CHARGE_LE: 'B4', COPIE: 'B5' };
// Adresse utilisée si Config!B2 est vide (site publié depuis le dépôt Arliack/ape-conseil-classe).
var URL_QUESTIONNAIRE_DEFAUT = 'https://arliack.github.io/ape-conseil-classe/questionnaires.json';

/* ========================================================================== */
/* Application web                                                             */
/* ========================================================================== */

function doGet() {
  return json_({ status: 'ok' });
}

function doPost(e) {
  try {
    var p = parserRequete_(e && e.postData && e.postData.contents);
    if (!p.ok) return json_({ ok: false, erreur: p.erreur });
    // Champ piège rempli : un robot. On fait semblant d'accepter, sans rien écrire.
    if (p.robot) return json_({ ok: true });

    var data = chargerQuestionnaires_(p.payload.version, false);
    var v = validerReponse_(p.payload, data);
    if (!v.ok) return json_({ ok: false, erreur: v.erreur });

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
/* Lecture et validation (fonctions pures, testées dans tests/apps-script.test.js) */
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
 * Vérifie une réponse au regard du questionnaire et la met en forme pour le Sheet.
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
/* Questionnaire : chargement depuis le site                                   */
/* ========================================================================== */

/**
 * Renvoie le questionnaire. Ordre : cache (6 h) → fichier publié sur le site → copie de secours
 * dans Config. Si le site annonce une autre version que celle en cache, on relit le fichier.
 */
function chargerQuestionnaires_(versionAttendue, forcer) {
  var cache = CacheService.getScriptCache();
  var enCache = lireJson_(cache.get(CACHE_CLE));
  if (enCache && !forcer && (!versionAttendue || enCache.version === versionAttendue)) return enCache;

  // Au plus un téléchargement par minute, sauf demande explicite depuis le menu.
  if (forcer || !cache.get('recharge-recente')) {
    cache.put('recharge-recente', '1', 60);
    try {
      var frais = telechargerQuestionnaires_();
      cache.put(CACHE_CLE, JSON.stringify(frais), CACHE_DUREE);
      ecrireConfig_(frais);
      return frais;
    } catch (err) {
      console.warn('Questionnaire non téléchargé : ' + err.message);
      if (forcer) throw err;
    }
  }
  if (enCache) return enCache;

  var copie = lireCopieConfig_();
  if (copie) {
    cache.put(CACHE_CLE, JSON.stringify(copie), CACHE_DUREE);
    return copie;
  }
  throw new Error("Questionnaire introuvable : renseigner l'URL dans l'onglet Config (B2), puis APE > Recharger le questionnaire.");
}

function telechargerQuestionnaires_() {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ONGLETS.CONFIG);
  var url = (sh ? String(sh.getRange(CONFIG.URL).getValue()).trim() : '') || URL_QUESTIONNAIRE_DEFAUT;
  if (!/^https:\/\//.test(url)) throw new Error("URL du questionnaire invalide dans l'onglet Config (B2).");
  // Paramètre anti-cache : GitHub Pages garde les fichiers 10 min en cache.
  var rep = UrlFetchApp.fetch(url + (url.indexOf('?') === -1 ? '?' : '&') + 't=' + Date.now(), { muteHttpExceptions: true });
  if (rep.getResponseCode() !== 200) throw new Error('Téléchargement impossible (HTTP ' + rep.getResponseCode() + ') : ' + url);
  var data = lireJson_(rep.getContentText('UTF-8'));
  var erreur = verifierStructure_(data);
  if (erreur) throw new Error('questionnaires.json invalide : ' + erreur);
  return data;
}

/** Contrôle minimal (le contrôle complet est fait par les tests du dépôt). */
function verifierStructure_(data) {
  if (!data || typeof data !== 'object') return 'pas un objet JSON';
  if (!Array.isArray(data.echelle4) || data.echelle4.length !== 4) return '"echelle4" doit contenir 4 valeurs';
  if (!data.listes || !Array.isArray(data.listes.classes)) return '"listes.classes" manquant';
  if (!data.questionnaires || typeof data.questionnaires !== 'object') return '"questionnaires" manquant';
  var cles = Object.keys(data.questionnaires);
  for (var i = 0; i < cles.length; i++) {
    var q = data.questionnaires[cles[i]];
    if (!Array.isArray(q.themes) || !Array.isArray(q.questions)) return cles[i] + ' : "themes" ou "questions" manquant';
    if (!q.questions.some(function (qu) { return qu.id === 'classe'; })) return cles[i] + ' : question "classe" manquante';
  }
  return '';
}

function lireJson_(txt) {
  if (!txt) return null;
  try { return JSON.parse(txt); } catch (_) { return null; }
}

function lireCopieConfig_() {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ONGLETS.CONFIG);
  return sh ? lireJson_(String(sh.getRange(CONFIG.COPIE).getValue())) : null;
}

/** Onglet Config : version chargée, copie de secours, et reflet des listes (classes, matières). */
function ecrireConfig_(data) {
  var sh = assurerOngletConfig_(SpreadsheetApp.getActiveSpreadsheet());
  var copie = JSON.stringify(data);
  sh.getRange(CONFIG.VERSION).setValue(String(data.version || ''));
  sh.getRange(CONFIG.CHARGE_LE).setValue(new Date());
  sh.getRange(CONFIG.COPIE).setValue(copie.length < 49000 ? copie : '(trop long pour une copie de secours)');

  var listes = [['Classes', data.listes.classes || []], ['Matières', data.listes.matieres || []]];
  sh.getRange(1, 4, Math.max(sh.getMaxRows(), 2), 2).clearContent();
  listes.forEach(function (l, k) {
    var valeurs = [[l[0]]].concat(l[1].map(function (v) { return [v]; }));
    sh.getRange(1, 4 + k, valeurs.length, 1).setValues(valeurs);
  });
  sh.getRange(1, 4, 1, 2).setFontWeight('bold');
}

function assurerOngletConfig_(ss) {
  var sh = ss.getSheetByName(ONGLETS.CONFIG);
  if (sh) return sh;
  sh = ss.insertSheet(ONGLETS.CONFIG, 0);
  sh.getRange('A1:B5').setValues([
    ['Paramètre', 'Valeur'],
    ['URL du questionnaire (questionnaires.json sur le site)', URL_QUESTIONNAIRE_DEFAUT],
    ['Version chargée', ''],
    ['Chargé le', ''],
    ['Copie de secours (ne pas modifier)', '']
  ]);
  sh.getRange('A1:B1').setFontWeight('bold');
  sh.getRange(CONFIG.COPIE).setWrap(false);
  sh.setColumnWidth(1, 330);
  sh.setColumnWidth(2, 420);
  sh.getRange('A7').setValue('Les questions, classes et matières se modifient dans src/data/questionnaires.json (dépôt GitHub), pas ici. ' +
    'Les colonnes D et E reflètent la dernière version chargée.');
  sh.getRange('A7').setFontColor('#4a5560');
  return sh;
}

/* ========================================================================== */
/* Enregistrement                                                              */
/* ========================================================================== */

function nomOngletReponses_(cle) {
  return ONGLETS_REPONSES[cle] || ('Reponses_' + cle);
}

/**
 * Crée l'onglet si besoin et ajoute à droite les colonnes manquantes. Les colonnes existantes ne
 * sont jamais supprimées ni déplacées : l'APE peut les réordonner, le script les retrouve par leur id.
 */
function assurerOngletReponses_(ss, cle, data) {
  var nom = nomOngletReponses_(cle);
  var sh = ss.getSheetByName(nom) || ss.insertSheet(nom);
  var nbCol = sh.getLastColumn();
  var entetes = nbCol ? sh.getRange(1, 1, 1, nbCol).getValues()[0].map(String) : [];
  var manquantes = colonnesAttendues_(data.questionnaires[cle], data).filter(function (c) {
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
  var o = assurerOngletReponses_(SpreadsheetApp.getActiveSpreadsheet(), r.questionnaire, data);
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
    version: neutraliserFormule_(r.version)    // « 2026-11-01 » ne doit pas devenir une date
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
    .addItem('Mettre à jour la synthèse', 'buildSynthese')
    .addItem('Recharger le questionnaire et les colonnes', 'rechargerQuestionnaire')
    .addSeparator()
    .addItem('Installer le classeur', 'installer')
    .addToUi();
}

/** Première installation : onglets, URL du questionnaire, colonnes. */
function installer() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ui = SpreadsheetApp.getUi();
  var config = assurerOngletConfig_(ss);
  if (!String(config.getRange(CONFIG.URL).getValue()).trim()) {
    var rep = ui.prompt('Adresse du questionnaire',
      'Collez l\'adresse de questionnaires.json sur le site, par exemple :\n' + URL_QUESTIONNAIRE_DEFAUT,
      ui.ButtonSet.OK_CANCEL);
    if (rep.getSelectedButton() !== ui.Button.OK) return;
    config.getRange(CONFIG.URL).setValue(rep.getResponseText().trim());
  }
  if (!ss.getSheetByName(ONGLETS.SYNTHESE)) ss.insertSheet(ONGLETS.SYNTHESE);
  rechargerQuestionnaire();
  var feuille1 = ss.getSheetByName('Feuille 1') || ss.getSheetByName('Sheet1');
  if (feuille1 && feuille1.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(feuille1);
}

/** Relit questionnaires.json sur le site et ajoute les colonnes des nouvelles questions. */
function rechargerQuestionnaire() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var data = chargerQuestionnaires_(null, true);
  var resume = Object.keys(data.questionnaires).map(function (cle) {
    assurerOngletReponses_(ss, cle, data);
    return data.questionnaires[cle].titre + ' : ' + data.questionnaires[cle].questions.length + ' questions';
  });
  ss.toast(resume.join('\n'), 'Questionnaire version ' + data.version + ' chargé', 8);
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
  var data = chargerQuestionnaires_(null, false);
  var lignesParQ = {};
  Object.keys(data.questionnaires).forEach(function (cle) {
    lignesParQ[cle] = lireReponses_(ss.getSheetByName(nomOngletReponses_(cle)));
  });
  var synthese = calculerSynthese_(data, lignesParQ);
  var maintenant = Utilities.formatDate(new Date(), ss.getSpreadsheetTimeZone(), "dd/MM/yyyy 'à' HH:mm");

  ss.getSheets().forEach(function (sh) {
    if (sh.getName().indexOf(ONGLETS.PREFIXE_CLASSE) === 0) ss.deleteSheet(sh);
  });

  var vue = ss.getSheetByName(ONGLETS.SYNTHESE) || ss.insertSheet(ONGLETS.SYNTHESE);
  ecrireTableau_(vue, lignesVueEnsemble_(synthese, data, maintenant), [380, 140, 140, 220]);

  synthese.forEach(function (resClasse) {
    if (!resClasse.total) return;
    var sh = ss.insertSheet(ONGLETS.PREFIXE_CLASSE + resClasse.classe);
    ecrireTableau_(sh, lignesSyntheseClasse_(resClasse, data, maintenant), [380, 80, 80, 80, 80, 80]);
  });
  ss.setActiveSheet(vue);
  ss.toast('Synthèse mise à jour.', 'APE', 5);
}

/** Lignes de l'onglet de réponses → objets { id: valeur }. Les choix multiples redeviennent des listes. */
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
  var pire = echelle[echelle.length - 1];
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
        if (eff[echelle.indexOf(pire)] > 0) pasBien.push({ libelle: qu.libelle, theme: t.titre, n: eff[echelle.indexOf(pire)], sur: n });
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
  var cles = Object.keys(data.questionnaires);
  var L = [
    { v: ['Synthèse des questionnaires · conseil de classe'], s: 'titre' },
    { v: ['Mise à jour le ' + maintenant + ' (menu APE > Mettre à jour la synthèse)'], s: 'note' },
    { v: ['Les noms ne figurent jamais dans la synthèse. Relisez les commentaires avant de les présenter : ils peuvent contenir des détails qui identifient quelqu\'un.'], s: 'note' },
    { v: [''], s: '' },
    { v: ['Classe'].concat(cles.map(function (c) { return 'Réponses ' + c; })).concat(['Onglet']), s: 'entete' }
  ];
  synthese.forEach(function (r) {
    L.push({
      v: [r.classe].concat(cles.map(function (c) { return r.questionnaires[c].n; }))
        .concat([r.total ? ONGLETS.PREFIXE_CLASSE + r.classe : '(aucune réponse)']),
      s: 'ligne'
    });
  });
  return L;
}

function lignesSyntheseClasse_(r, data, maintenant) {
  var echelle = data.echelle4;
  var L = [{ v: ['Synthèse ' + r.classe + ' · conseil de classe'], s: 'titre' }];
  var resume = Object.keys(data.questionnaires).map(function (cle) {
    return data.questionnaires[cle].titre + ' : ' + r.questionnaires[cle].n + ' réponse(s)';
  });
  L.push({ v: [resume.join(' · ') + ' · mise à jour le ' + maintenant], s: 'note' });

  Object.keys(data.questionnaires).forEach(function (cle) {
    var s = r.questionnaires[cle];
    L.push({ v: [''], s: '' });
    L.push({ v: [data.questionnaires[cle].titre.toUpperCase() + ' · ' + s.n + ' réponse(s)'], s: 'section' });
    if (!s.n) {
      L.push({ v: ['Aucune réponse pour cette classe.'], s: 'note' });
      return;
    }

    if (s.pasBien.length) {
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
  appliquer('section', 'A:' + der, function (rl) { rl.setFontSize(12).setFontWeight('bold').setBackground('#0c92ab'); });
  appliquer('theme', 'A:' + der, function (rl) { rl.setFontSize(11).setFontWeight('bold').setBackground('#eef6f8'); });
  appliquer('entete', 'A:' + der, function (rl) { rl.setFontWeight('bold').setFontColor('#4a5560'); });
  appliquer('sous-titre', 'A', function (rl) { rl.setFontWeight('bold'); });
  appliquer('pct-be', 'B:E', function (rl) { rl.setNumberFormat('0%'); });
  appliquer('pct-c', 'C', function (rl) { rl.setNumberFormat('0%'); });

  // Titres, notes et commentaires sur toute la largeur (pour l'impression),
  // fusionnés par blocs de lignes consécutives pour limiter les appels.
  var aFusionner = ['titre', 'note', 'section', 'theme', 'sous-titre', 'commentaire'];
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
