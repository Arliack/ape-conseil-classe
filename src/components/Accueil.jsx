import { lireDejaRepondu } from '../lib/stockage.js';

function dateCourte(iso) {
  try {
    return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
  } catch {
    return '';
  }
}

export default function Accueil({ data }) {
  const { site, questionnaires } = data;

  return (
    <>
      <h1>Préparer le conseil de classe</h1>
      <p className="chapeau">Élèves et parents, donnez votre avis avant le conseil.</p>
      <p>
        Les délégués de parents lisent vos réponses pour porter la parole des familles au conseil de classe.
        Cinq à dix minutes suffisent. Le nom est facultatif.
      </p>

      <ul className="choix-public">
        {Object.entries(questionnaires).map(([cle, q]) => {
          const deja = lireDejaRepondu(cle);
          return (
            <li key={cle}>
              <a className="bouton bouton-public" href={`#/${cle}`}>
                {q.bouton_accueil}
              </a>
              {deja && (
                <p className="note">
                  Déjà répondu depuis cet appareil{deja.le ? ` le ${dateCourte(deja.le)}` : ''}. Vous pouvez
                  répondre à nouveau, par exemple pour un autre enfant.
                </p>
              )}
            </li>
          );
        })}
      </ul>

      <section className="encadre" aria-labelledby="titre-donnees">
        <h2 id="titre-donnees">Vos données</h2>
        <ul className="liste-donnees">
          <li>
            <strong>Pourquoi :</strong> préparer les conseils de classe. Les réponses servent uniquement à
            cela.
          </li>
          <li>
            <strong>Qui les lit :</strong> les délégués de parents de la classe et le bureau de l'APE. Elles
            ne sont pas transmises au collège avec un nom : les délégués présentent une synthèse anonyme.
          </li>
          <li>
            <strong>Le nom :</strong> facultatif. Il n'apparaît jamais dans la synthèse. Les élèves et les
            parents répondent séparément : un parent ne voit pas les réponses de son enfant.
          </li>
          <li>
            <strong>Combien de temps :</strong> {site.conservation}
          </li>
          <li>
            <strong>Où :</strong> dans un tableau Google privé de l'APE. Ce site ne dépose aucun cookie et ne
            mesure pas les visites.
          </li>
          <li>
            <strong>Contact :</strong> pour toute question ou pour faire supprimer une réponse, écrivez à{' '}
            <a href={`mailto:${site.contact}`}>{site.contact}</a>.
          </li>
        </ul>
      </section>
    </>
  );
}
