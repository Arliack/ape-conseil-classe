// Logique pure du questionnaire (aucun accès au DOM ni au stockage), partagée par
// l'interface et les tests. Les mêmes règles existent côté serveur dans
// apps-script/Code.gs : tests/parite.test.js vérifie qu'elles donnent le même résultat.

export const CLE = 'parents'; // nom du questionnaire dans les données publiées
export const MAX_TEXTE_DEFAUT = 1000;
export const MAX_PRECISION = 500;
export const SUFFIXE_PRECISION = '_precision';

export function optionsDe(question, data) {
  if (question.type === 'echelle4') return data.echelle4;
  if (question.liste) return data.listes[question.liste] || [];
  return question.options || [];
}

export function precisionSi(question, data) {
  if (Array.isArray(question.precision_si)) return question.precision_si;
  if (question.type === 'echelle4') return data.precision_echelle4 || [];
  return [];
}

export function niveauDe(classe) {
  return String(classe || '').trim().split(/\s+/)[0];
}

function enListe(valeur) {
  if (Array.isArray(valeur)) return valeur;
  return valeur === undefined || valeur === null || valeur === '' ? [] : [valeur];
}

function croise(valeur, valeurs) {
  return enListe(valeur).some((v) => valeurs.includes(v));
}

export function conditionRemplie(afficherSi, reponses) {
  if (!afficherSi) return true;
  if (afficherSi.niveau) return afficherSi.niveau.includes(niveauDe(reponses.classe));
  if (afficherSi.question) return croise(reponses[afficherSi.question], afficherSi.valeurs || []);
  return true;
}

export function questionVisible(q, question, reponses) {
  const theme = q.themes.find((t) => t.id === question.theme);
  return conditionRemplie(theme && theme.afficher_si, reponses) && conditionRemplie(question.afficher_si, reponses);
}

export function questionsDuTheme(q, themeId, reponses) {
  return q.questions.filter((qu) => qu.theme === themeId && questionVisible(q, qu, reponses));
}

/** Thèmes affichés comme étapes : condition remplie et au moins une question visible. */
export function themesVisibles(q, reponses) {
  return q.themes.filter(
    (t) => conditionRemplie(t.afficher_si, reponses) && questionsDuTheme(q, t.id, reponses).length > 0
  );
}

export function precisionVisible(question, valeur, data) {
  return croise(valeur, precisionSi(question, data));
}

export function estVide(valeur) {
  if (Array.isArray(valeur)) return valeur.length === 0;
  return valeur === undefined || valeur === null || String(valeur).trim() === '';
}

export function maxTexte(question) {
  return question.max || MAX_TEXTE_DEFAUT;
}

/** Erreurs d'une étape : { idQuestion: message }. Vide si l'étape est valide. */
export function erreursTheme(q, data, themeId, reponses) {
  const erreurs = {};
  for (const question of questionsDuTheme(q, themeId, reponses)) {
    const valeur = reponses[question.id];
    if (question.obligatoire && estVide(valeur)) {
      erreurs[question.id] = 'Merci de répondre à cette question.';
    } else if (question.type === 'texte' && typeof valeur === 'string' && valeur.length > maxTexte(question)) {
      erreurs[question.id] = `${maxTexte(question)} caractères maximum.`;
    }
    const precision = reponses[question.id + SUFFIXE_PRECISION];
    if (precisionVisible(question, valeur, data) && typeof precision === 'string' && precision.length > MAX_PRECISION) {
      erreurs[question.id] = `${MAX_PRECISION} caractères maximum pour la précision.`;
    }
  }
  return erreurs;
}

/**
 * Réponses à envoyer : seulement les questions visibles, les précisions déclenchées,
 * les textes nettoyés. Une réponse masquée après coup (ex. classe changée de 3e en 6e)
 * n'est donc jamais envoyée.
 */
export function reponsesAEnvoyer(q, data, reponses) {
  const sortie = {};
  for (const question of q.questions) {
    if (!questionVisible(q, question, reponses)) continue;
    const valeur = reponses[question.id];
    if (estVide(valeur)) continue;
    sortie[question.id] = typeof valeur === 'string' ? valeur.trim() : valeur;
    const cle = question.id + SUFFIXE_PRECISION;
    if (precisionVisible(question, valeur, data) && !estVide(reponses[cle])) {
      sortie[cle] = String(reponses[cle]).trim();
    }
  }
  return sortie;
}

export function construirePayload(data, cle, reponses, { id, site = '' }) {
  return {
    questionnaire: cle,
    version: data.version,
    id,
    site,
    reponses: reponsesAEnvoyer(data.questionnaires[cle], data, reponses),
  };
}
