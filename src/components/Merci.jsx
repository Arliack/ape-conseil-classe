import { useEffect, useRef } from 'react';

export default function Merci({ data, cle }) {
  const q = data.questionnaires[cle];
  const titre = useRef(null);

  useEffect(() => {
    titre.current?.focus();
  }, []);

  return (
    <div className="merci">
      <h1 ref={titre} tabIndex={-1}>Merci !</h1>
      <p className="chapeau">{q.merci}</p>
      {data.site.prochain_conseil && <p className="encadre">{data.site.prochain_conseil}</p>}
      <div className="actions-merci">
        <a className="bouton bouton-principal" href="#/questionnaire">Répondre pour un autre enfant</a>
        <a className="bouton bouton-secondaire" href="#/">Retour à l'accueil</a>
      </div>
    </div>
  );
}
