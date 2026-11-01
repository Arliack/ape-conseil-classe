import { useEffect, useState } from 'react';
import data from './data/questionnaires.json';
import Entete from './components/Entete.jsx';
import Accueil from './components/Accueil.jsx';
import Questionnaire from './components/Questionnaire.jsx';
import Merci from './components/Merci.jsx';

// Navigation par hash : fonctionne sur GitHub Pages sans configuration serveur, et
// permet de diffuser un lien direct par public (#/eleves pour les élèves, #/parents pour les parents).
function lireRoute() {
  const [, vue, cle] = window.location.hash.split('/');
  if ((vue === 'eleves' || vue === 'parents') && data.questionnaires[vue]) return { vue: 'questionnaire', cle: vue };
  if (vue === 'merci' && data.questionnaires[cle]) return { vue: 'merci', cle };
  return { vue: 'accueil' };
}

export default function App() {
  const [route, setRoute] = useState(lireRoute);

  useEffect(() => {
    const surChangement = () => {
      setRoute(lireRoute());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', surChangement);
    return () => window.removeEventListener('hashchange', surChangement);
  }, []);

  useEffect(() => {
    const titre = route.cle ? data.questionnaires[route.cle].titre : 'Conseil de classe';
    document.title = `${titre} · APE Raymond Queneau`;
  }, [route]);

  return (
    <>
      <a className="lien-evitement" href="#contenu">Aller au contenu</a>
      <Entete site={data.site} />
      <main id="contenu" className="contenu" tabIndex={-1}>
        {route.vue === 'accueil' && <Accueil data={data} />}
        {route.vue === 'questionnaire' && <Questionnaire key={route.cle} data={data} cle={route.cle} />}
        {route.vue === 'merci' && <Merci data={data} cle={route.cle} />}
      </main>
      <footer className="pied">
        <p>
          L'équipe de l'{data.site.association} ·{' '}
          <a href={`mailto:${data.site.contact}`}>{data.site.contact}</a>
        </p>
        <p>Aucun cookie, aucun suivi, aucune statistique de visite.</p>
      </footer>
    </>
  );
}
