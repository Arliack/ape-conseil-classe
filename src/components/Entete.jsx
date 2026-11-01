import { useState } from 'react';

// Logo APE 2025 attendu dans public/logo-ape.png. Tant qu'il manque, le nom s'affiche en texte.
export default function Entete({ site }) {
  const [logoAbsent, setLogoAbsent] = useState(false);

  return (
    <header className="entete">
      <div className="bandeau" aria-hidden="true">
        <span className="bandeau-sun" />
        <span className="bandeau-teal" />
        <span className="bandeau-leaf" />
      </div>
      <div className="entete-int">
        <a className="marque" href="#/">
          {!logoAbsent && (
            <img
              className="logo"
              src={`${import.meta.env.BASE_URL}logo-ape.png`}
              alt="Association des Parents d'Élèves, Collège Raymond Queneau"
              width="160"
              onError={() => setLogoAbsent(true)}
            />
          )}
          {logoAbsent && (
            <span className="marque-texte">
              <span className="marque-asso">Association des Parents d'Élèves</span>
              <span className="marque-college">{site.college}</span>
            </span>
          )}
        </a>
        <div className="motif" aria-hidden="true">
          <span className="motif-lame" />
          <span className="motif-carre" />
        </div>
      </div>
    </header>
  );
}
