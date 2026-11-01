import { MAX_PRECISION, SUFFIXE_PRECISION, maxTexte, optionsDe, precisionVisible } from '../lib/questionnaire.js';

function Obligatoire() {
  return (
    <>
      <span className="etoile" aria-hidden="true"> *</span>
      <span className="sr-only"> (obligatoire)</span>
    </>
  );
}

function Compteur({ valeur, max }) {
  const n = (valeur || '').length;
  return (
    <p className="compteur" aria-hidden={n < max * 0.8}>
      {n} / {max}
    </p>
  );
}

function ChampTexte({ id, valeur, max, court, onChange, decritPar, invalide, requis }) {
  const commun = {
    id,
    value: valeur || '',
    maxLength: max,
    onChange: (e) => onChange(e.target.value),
    'aria-describedby': decritPar || undefined,
    'aria-invalid': invalide || undefined,
    'aria-required': requis || undefined,
  };
  return court ? <input type="text" autoComplete="off" {...commun} /> : <textarea rows={3} {...commun} />;
}

export default function Question({ question, data, reponses, onChange, erreur, libellePrecision }) {
  const id = `q-${question.id}`;
  const valeur = reponses[question.id];
  const idErreur = erreur ? `${id}-erreur` : '';
  const idAide = question.aide ? `${id}-aide` : '';
  const decritPar = [idAide, idErreur].filter(Boolean).join(' ');
  const options = optionsDe(question, data);
  const changer = (v) => onChange(question.id, v);

  const aide = question.aide && <p id={idAide} className="aide">{question.aide}</p>;
  const messageErreur = erreur && (
    <p id={idErreur} className="erreur-champ">
      {erreur}
    </p>
  );

  let champ;
  if (question.type === 'texte') {
    champ = (
      <div className={`question${erreur ? ' en-erreur' : ''}`} data-question={question.id}>
        <label className="libelle" htmlFor={id}>
          {question.libelle}
          {question.obligatoire && <Obligatoire />}
        </label>
        {aide}
        <ChampTexte
          id={id}
          valeur={valeur}
          max={maxTexte(question)}
          court={question.court}
          onChange={changer}
          decritPar={decritPar}
          invalide={!!erreur}
          requis={question.obligatoire}
        />
        <Compteur valeur={valeur} max={maxTexte(question)} />
        {messageErreur}
      </div>
    );
  } else if (question.type === 'choix_unique' && question.affichage === 'liste') {
    champ = (
      <div className={`question${erreur ? ' en-erreur' : ''}`} data-question={question.id}>
        <label className="libelle" htmlFor={id}>
          {question.libelle}
          {question.obligatoire && <Obligatoire />}
        </label>
        {aide}
        <select
          id={id}
          value={valeur || ''}
          onChange={(e) => changer(e.target.value)}
          aria-describedby={decritPar || undefined}
          aria-invalid={!!erreur || undefined}
          aria-required={question.obligatoire || undefined}
        >
          <option value="">Choisir…</option>
          {options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        {messageErreur}
      </div>
    );
  } else {
    const multiple = question.type === 'choix_multiple';
    const coches = multiple ? (Array.isArray(valeur) ? valeur : []) : [];
    const basculer = (o) => changer(coches.includes(o) ? coches.filter((c) => c !== o) : [...coches, o]);
    champ = (
      <fieldset
        className={`question${erreur ? ' en-erreur' : ''}`}
        data-question={question.id}
        aria-describedby={decritPar || undefined}
      >
        <legend className="libelle">
          {question.libelle}
          {question.obligatoire && <Obligatoire />}
          {multiple && <span className="indication"> (plusieurs réponses possibles)</span>}
        </legend>
        {aide}
        <div className={question.type === 'echelle4' ? 'pastilles echelle' : 'pastilles liste-choix'}>
          {options.map((o, i) => (
            <label key={o} className="pastille">
              <input
                type={multiple ? 'checkbox' : 'radio'}
                id={`${id}-${i}`}
                name={id}
                value={o}
                checked={multiple ? coches.includes(o) : valeur === o}
                onChange={() => (multiple ? basculer(o) : changer(o))}
                aria-invalid={!!erreur || undefined}
              />
              <span>{o}</span>
            </label>
          ))}
        </div>
        {!multiple && !question.obligatoire && valeur && (
          <button type="button" className="bouton-lien" onClick={() => changer('')}>
            Effacer ma réponse
          </button>
        )}
        {messageErreur}
      </fieldset>
    );
  }

  const cleP = question.id + SUFFIXE_PRECISION;
  const idP = `q-${cleP}`;
  const afficherPrecision = precisionVisible(question, valeur, data);

  return (
    <div className="bloc-question">
      {champ}
      {afficherPrecision && (
        <div className="precision">
          <label className="libelle" htmlFor={idP}>
            {question.precision_libelle || libellePrecision}
          </label>
          <ChampTexte
            id={idP}
            valeur={reponses[cleP]}
            max={MAX_PRECISION}
            onChange={(v) => onChange(cleP, v)}
          />
          <Compteur valeur={reponses[cleP]} max={MAX_PRECISION} />
        </div>
      )}
    </div>
  );
}
