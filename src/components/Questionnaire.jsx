import { useEffect, useRef, useState } from 'react';
import Question from './Question.jsx';
import { construirePayload, erreursTheme, questionsDuTheme, themesVisibles } from '../lib/questionnaire.js';
import { effacerBrouillon, ecrireBrouillon, lireBrouillon, marquerDejaRepondu, nouvelId } from '../lib/stockage.js';
import { envoyerReponse } from '../lib/envoi.js';

function brouillonInitial(cle) {
  const b = lireBrouillon(cle);
  if (b && b.reponses && typeof b.reponses === 'object' && b.id) {
    return { id: b.id, reponses: b.reponses, etape: Number(b.etape) || 0 };
  }
  return { id: nouvelId(), reponses: {}, etape: 0 };
}

export default function Questionnaire({ data, cle }) {
  const q = data.questionnaires[cle];
  const [initial] = useState(() => brouillonInitial(cle));
  const [id, setId] = useState(initial.id);
  const [reponses, setReponses] = useState(initial.reponses);
  const [etape, setEtape] = useState(initial.etape);
  const [erreurs, setErreurs] = useState({});
  const [envoi, setEnvoi] = useState({ statut: 'repos', message: '' });
  const [piege, setPiege] = useState('');
  const titreEtape = useRef(null);
  const premierRendu = useRef(true);

  const themes = themesVisibles(q, reponses);
  const indice = Math.min(etape, themes.length - 1);
  const theme = themes[indice];
  const derniere = indice === themes.length - 1;

  useEffect(() => {
    ecrireBrouillon(cle, { id, reponses, etape: indice });
  }, [cle, id, reponses, indice]);

  // Changement d'étape : on remonte en haut et on place le focus sur le titre,
  // pour que les lecteurs d'écran annoncent la nouvelle étape.
  useEffect(() => {
    if (premierRendu.current) {
      premierRendu.current = false;
      return;
    }
    window.scrollTo(0, 0);
    titreEtape.current?.focus();
  }, [indice]);

  const changer = (cleReponse, valeur) => {
    setReponses((r) => ({ ...r, [cleReponse]: valeur }));
    if (erreurs[cleReponse]) setErreurs(({ [cleReponse]: _, ...reste }) => reste);
  };

  const focaliserPremiereErreur = (errs) => {
    const premiere = questionsDuTheme(q, theme.id, reponses).find((qu) => errs[qu.id]);
    if (!premiere) return;
    const bloc = document.querySelector(`[data-question="${premiere.id}"]`);
    bloc?.querySelector('input, select, textarea')?.focus();
  };

  const envoyer = async () => {
    setEnvoi({ statut: 'envoi', message: '' });
    try {
      await envoyerReponse(construirePayload(data, cle, reponses, { id, site: piege }));
      marquerDejaRepondu(cle);
      effacerBrouillon(cle);
      window.location.hash = `#/merci/${cle}`;
    } catch (e) {
      setEnvoi({ statut: 'erreur', message: e.message });
    }
  };

  const suivant = (e) => {
    e.preventDefault();
    const errs = erreursTheme(q, data, theme.id, reponses);
    setErreurs(errs);
    if (Object.keys(errs).length) {
      focaliserPremiereErreur(errs);
      return;
    }
    if (derniere) envoyer();
    else setEtape(indice + 1);
  };

  const precedent = () => {
    setErreurs({});
    setEtape(Math.max(0, indice - 1));
  };

  const toutEffacer = () => {
    const ok = window.confirm('Effacer toutes vos réponses et recommencer ?');
    if (!ok) return;
    effacerBrouillon(cle);
    setId(nouvelId());
    setReponses({});
    setErreurs({});
    setEnvoi({ statut: 'repos', message: '' });
    setEtape(0);
    titreEtape.current?.focus();
  };

  const nbErreurs = Object.keys(erreurs).length;
  const enCours = envoi.statut === 'envoi';

  return (
    <form className="questionnaire" onSubmit={suivant} noValidate>
      <p className="sur-titre">{q.titre}</p>

      <div className="progression">
        <p className="progression-texte" id="progression-texte">
          Étape {indice + 1} sur {themes.length}
        </p>
        <div
          className="barre"
          role="progressbar"
          aria-labelledby="progression-texte"
          aria-valuemin={1}
          aria-valuemax={themes.length}
          aria-valuenow={indice + 1}
        >
          <span style={{ width: `${((indice + 1) / themes.length) * 100}%` }} />
        </div>
      </div>

      <h1 ref={titreEtape} tabIndex={-1} className="titre-etape">
        {theme.titre}
      </h1>
      {indice === 0 && <p className="chapeau">{q.intro}</p>}
      {theme.intro && <p className="intro-theme">{theme.intro}</p>}
      {indice === 0 && (
        <p className="note">
          <span aria-hidden="true">* </span>
          Les questions marquées d’une étoile sont obligatoires.
        </p>
      )}

      {nbErreurs > 0 && (
        <p className="message message-erreur" role="alert">
          {nbErreurs === 1 ? 'Une question demande une réponse.' : `${nbErreurs} questions demandent une réponse.`}
        </p>
      )}

      {questionsDuTheme(q, theme.id, reponses).map((question) => (
        <Question
          key={question.id}
          question={question}
          data={data}
          reponses={reponses}
          onChange={changer}
          erreur={erreurs[question.id]}
          libellePrecision={q.precision_libelle}
        />
      ))}

      {/* Champ piège : invisible pour un humain, souvent rempli par les robots. */}
      <div className="piege" aria-hidden="true">
        <label htmlFor="site">Site web</label>
        <input id="site" name="site" type="text" tabIndex={-1} autoComplete="off" value={piege} onChange={(e) => setPiege(e.target.value)} />
      </div>

      {envoi.statut === 'erreur' && (
        <div className="message message-erreur" role="alert">
          <p>
            <strong>L'envoi n'a pas fonctionné.</strong> {envoi.message}
          </p>
          <p>Vos réponses sont conservées : vous pouvez réessayer.</p>
        </div>
      )}

      <div className="actions">
        {indice > 0 ? (
          <button type="button" className="bouton bouton-secondaire" onClick={precedent} disabled={enCours}>
            Précédent
          </button>
        ) : (
          <a className="bouton bouton-secondaire" href="#/">
            Accueil
          </a>
        )}
        <button type="submit" className="bouton bouton-principal" disabled={enCours} aria-busy={enCours || undefined}>
          {derniere ? (enCours ? 'Envoi…' : envoi.statut === 'erreur' ? 'Réessayer l’envoi' : 'Envoyer mes réponses') : 'Suivant'}
        </button>
      </div>

      <p className="effacer">
        <button type="button" className="bouton-lien" onClick={toutEffacer} disabled={enCours}>
          Effacer mes réponses et recommencer
        </button>
      </p>
    </form>
  );
}
