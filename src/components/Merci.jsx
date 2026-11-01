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
      <p>
        <a className="bouton bouton-secondaire" href="#/">Retour à l'accueil</a>
      </p>
    </div>
  );
}
