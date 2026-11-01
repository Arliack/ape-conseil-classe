// Échanges avec l'application web Apps Script.
// POST en Content-Type text/plain : la requête reste « simple » au sens CORS, donc pas de
// requête préalable OPTIONS (qu'Apps Script ne sait pas traiter). Le script lit le JSON du corps.

const URL_SCRIPT = (import.meta.env.VITE_APPS_SCRIPT_URL || '').trim();

async function lireJson(reponse) {
  try {
    return await reponse.json();
  } catch {
    return null; // Réponse non JSON (page d'erreur Google, quota…).
  }
}

/** Questions publiées depuis l'onglet « Questions » du Sheet. */
export async function chargerQuestionnaire() {
  if (!URL_SCRIPT) {
    if (import.meta.env.DEV) {
      // En local sans URL configurée : questions d'exemple (npm run exemple pour les régénérer).
      return (await import('../dev/questionnaire-exemple.json')).default;
    }
    throw new Error("Le questionnaire n'est pas encore relié au tableau de l'APE.");
  }
  let reponse;
  try {
    reponse = await fetch(`${URL_SCRIPT}?action=questionnaire`, { redirect: 'follow' });
  } catch {
    throw new Error('Impossible de joindre le serveur. Vérifiez votre connexion, puis réessayez.');
  }
  const corps = await lireJson(reponse);
  if (!reponse.ok || !corps || corps.ok !== true || !corps.data) {
    throw new Error((corps && corps.erreur) || 'Le questionnaire ne peut pas être chargé pour le moment.');
  }
  return corps.data;
}

export async function envoyerReponse(payload) {
  if (!URL_SCRIPT) {
    if (import.meta.env.DEV) {
      console.info('[dev] VITE_APPS_SCRIPT_URL absent, envoi simulé :', payload);
      await new Promise((r) => setTimeout(r, 500));
      return;
    }
    throw new Error("Le questionnaire n'est pas encore relié au tableau de l'APE. Prévenez l'APE.");
  }

  let reponse;
  try {
    reponse = await fetch(URL_SCRIPT, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      redirect: 'follow',
    });
  } catch {
    throw new Error('Impossible de joindre le serveur. Vérifiez votre connexion, puis réessayez.');
  }
  const corps = await lireJson(reponse);
  if (!reponse.ok || !corps || corps.ok !== true) {
    throw new Error((corps && corps.erreur) || "L'envoi n'a pas abouti. Réessayez dans un instant.");
  }
}
