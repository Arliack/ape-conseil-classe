import { lireDejaRepondu } from '../lib/stockage.js';
import { CLE } from '../lib/questionnaire.js';

function dateCourte(iso) {
  try {
    return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
  } catch {
    return '';
  }
}

export default function Accueil({ data }) {
  const q = data.questionnaires[CLE];
  const deja = lireDejaRepondu(CLE);

  return (
    <>
      <h1>Préparer le conseil de classe</h1>
      <p className="chapeau">Parents, donnez votre avis avant le conseil.</p>
      <p>{q.intro}</p>
      <p>Cinq à dix minutes suffisent. Une réponse par enfant : si vous avez plusieurs enfants au collège, vous pourrez enchaîner.</p>

      <p className="choix-public">
        <a className="bouton bouton-public" href="#/questionnaire">
          Commencer le questionnaire
        </a>
      </p>
      {deja && (
        <p className="note">
          Vous avez déjà répondu depuis cet appareil{deja.le ? ` le ${dateCourte(deja.le)}` : ''}. Vous pouvez
          répondre à nouveau, par exemple pour un autre enfant.
        </p>
      )}

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
        </ul>
      </section>
    </>
  );
}
