// Accès au stockage du navigateur. Tout est protégé par try/catch : navigation privée,
// stockage bloqué ou plein ne doivent jamais empêcher de répondre.

function lire(zone, cle) {
  try {
    const brut = window[zone].getItem(cle);
    return brut ? JSON.parse(brut) : null;
  } catch {
    return null;
  }
}

function ecrire(zone, cle, valeur) {
  try {
    if (valeur === null) window[zone].removeItem(cle);
    else window[zone].setItem(cle, JSON.stringify(valeur));
  } catch {
    // Stockage indisponible : on continue sans.
  }
}

// Brouillon : sessionStorage, pour survivre à un rechargement sans rester sur un
// appareil partagé une fois l'onglet fermé.
const cleBrouillon = (q) => `ape-cc:brouillon:${q}`;
export const lireBrouillon = (q) => lire('sessionStorage', cleBrouillon(q));
export const ecrireBrouillon = (q, brouillon) => ecrire('sessionStorage', cleBrouillon(q), brouillon);
export const effacerBrouillon = (q) => ecrire('sessionStorage', cleBrouillon(q), null);

// « Déjà répondu » : localStorage, simple confort (pas une sécurité).
const cleDejaRepondu = (q) => `ape-cc:deja-repondu:${q}`;
export const lireDejaRepondu = (q) => lire('localStorage', cleDejaRepondu(q));
export const marquerDejaRepondu = (q) => ecrire('localStorage', cleDejaRepondu(q), { le: new Date().toISOString() });

export function nouvelId() {
  if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12);
}
