// Envoi d'une réponse à l'application web Apps Script.
// Content-Type text/plain : la requête reste « simple » au sens CORS, donc pas de
// requête préalable OPTIONS (qu'Apps Script ne sait pas traiter). Le script lit le JSON du corps.

const URL_SCRIPT = (import.meta.env.VITE_APPS_SCRIPT_URL || '').trim();

export async function envoyerReponse(payload) {
  if (!URL_SCRIPT) {
    if (import.meta.env.DEV) {
      // En local sans URL configurée : on simule un envoi réussi.
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
    throw new Error("Impossible de joindre le serveur. Vérifiez votre connexion, puis réessayez.");
  }

  let corps = null;
  try {
    corps = await reponse.json();
  } catch {
    // Réponse non JSON (page d'erreur Google, quota…).
  }
  if (!reponse.ok || !corps || corps.ok !== true) {
    throw new Error((corps && corps.erreur) || "L'envoi n'a pas abouti. Réessayez dans un instant.");
  }
}
