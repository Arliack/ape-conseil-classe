import { useCallback, useEffect, useState } from 'react';
import Entete from './components/Entete.jsx';
import Accueil from './components/Accueil.jsx';
import Questionnaire from './components/Questionnaire.jsx';
import Merci from './components/Merci.jsx';
import { chargerQuestionnaire } from './lib/envoi.js';
import { CLE } from './lib/questionnaire.js';

// Navigation par hash : fonctionne sur GitHub Pages sans configuration serveur.
// #/ accueil, #/questionnaire, #/merci. L'ancien lien #/parents reste valable.
function lireRoute() {
  const vue = window.location.hash.split('/')[1];
  if (vue === 'questionnaire' || vue === 'parents') return 'questionnaire';
  if (vue === 'merci') return 'merci';
  return 'accueil';
}

export default function App() {
  const [route, setRoute] = useState(lireRoute);
  const [etat, setEtat] = useState({ statut: 'chargement' });

  const charger = useCallback(() => {
    setEtat({ statut: 'chargement' });
    chargerQuestionnaire()
      .then((data) => setEtat({ statut: 'pret', data }))
      .catch((e) => setEtat({ statut: 'erreur', message: e.message }));
  }, []);

  useEffect(charger, [charger]);

  useEffect(() => {
    const surChangement = () => {
      setRoute(lireRoute());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', surChangement);
    return () => window.removeEventListener('hashchange', surChangement);
  }, []);

  const data = etat.data;
  useEffect(() => {
    const titre = data ? data.questionnaires[CLE].titre : 'Conseil de classe';
    document.title = `${titre} · APE Raymond Queneau`;
  }, [data]);

  return (
    <>
      <a className="lien-evitement" href="#contenu">Aller au contenu</a>
      <Entete />
      <main id="contenu" className="contenu" tabIndex={-1}>
        {etat.statut === 'chargement' && (
          <p className="chargement" role="status">Chargement du questionnaire…</p>
        )}
        {etat.statut === 'erreur' && (
          <div className="message message-erreur" role="alert">
            <p>{etat.message}</p>
            <p>
              <button type="button" className="bouton bouton-secondaire" onClick={charger}>
                Réessayer
              </button>
            </p>
          </div>
        )}
        {data && route === 'accueil' && <Accueil data={data} />}
        {data && route === 'questionnaire' && <Questionnaire key={data.version} data={data} cle={CLE} />}
        {data && route === 'merci' && <Merci data={data} cle={CLE} />}
      </main>
      <footer className="pied">
        <p>
          L'équipe de l'APE du collège Raymond Queneau
          {data?.site.contact && (
            <>
              {' · '}
              <a href={`mailto:${data.site.contact}`}>{data.site.contact}</a>
            </>
          )}
        </p>
        <p>Aucun cookie, aucun suivi, aucune statistique de visite.</p>
      </footer>
    </>
  );
}
