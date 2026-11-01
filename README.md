# Questionnaire conseil de classe – APE collège Raymond Queneau

Questionnaire en ligne pour les **parents**, à remplir avant le conseil de classe (une réponse par
enfant). Les réponses arrivent dans un Google Sheet privé de l'APE. **Les questions se modifient
directement dans le Sheet**, onglet `Questions`. Une synthèse par classe, sans les noms, est prête
à imprimer pour les délégués de parents.

```
parent ──▶ site statique (GitHub Pages) ──GET questions / POST réponse──▶ Apps Script ──▶ Google Sheet
                                                                         (onglets Questions, Config,
                                                                          Reponses_Parents, Synthese)
```

- Site : https://arliack.github.io/ape-conseil-classe/ (lien à diffuser)
- Sheet : « Conseil de classe – réponses 2026-2027 » sur le compte APE (clasp `--user ape`)
- Application web : `https://script.google.com/macros/s/AKfycbwu0_-QOC5RD9gkHpbL0ftg7bmdh74bgXNO__sfIMIQwEoMG8IX6QkXQGb0-YhZJOX1cg/exec`

## Arborescence

```
ape-conseil-classe/
├── src/
│   ├── lib/questionnaire.js       ← règles d'affichage et de validation (pures, testées)
│   ├── lib/envoi.js               ← GET des questions, POST des réponses (text/plain, sans requête CORS préalable)
│   ├── lib/stockage.js            ← brouillon (sessionStorage) et « déjà répondu » (localStorage)
│   ├── components/                ← Accueil, Questionnaire (étapes), Question, Merci, Entete
│   ├── dev/questionnaire-exemple.json ← questions de départ, pour le développement local uniquement
│   └── App.jsx, main.jsx, styles.css (charte APE)
├── public/logo-ape.png            ← À AJOUTER (logo APE 2025)
├── apps-script/Code.gs            ← tout le backend (un seul fichier)
├── apps-script/appsscript.json
├── tests/                         ← node --test, aucune dépendance
├── scripts/generer-exemple.js     ← npm run exemple
├── .github/workflows/deploy.yml   ← tests + build + publication GitHub Pages
└── EVOLUTIONS.md                  ← suite prévue (application parents / enfants)
```

## Modifier les questions

Tout se fait dans le Sheet, sans toucher au code ni au site :

1. Onglet **`Questions`** : une ligne par question. Survolez les en-têtes pour l'aide de chaque colonne.
2. Onglet **`Config`** : textes (titre, introduction, remerciement, date du prochain conseil,
   contact, durée de conservation), liste des **classes** (colonne D, format « 6e A ») et des
   **matières** (colonne E).
3. Menu **APE > Publier les questions**. Le script vérifie tout. S'il y a une erreur, il indique la
   ligne et ne publie rien. Sinon, le site affiche la nouvelle version dès la prochaine ouverture.

Tant que vous n'avez pas publié, le site garde l'ancienne version : vous pouvez modifier
l'onglet sans risque.

| Colonne | Rôle |
|---|---|
| **Masquer** | Cocher pour retirer la question du formulaire. Sa colonne de réponses reste dans le Sheet. |
| **Thème** | Chaque thème est une étape du formulaire, dans l'ordre d'apparition. |
| **Question** | Texte affiché. |
| **Type** | `Échelle 4 niveaux` (Très bien / Bien / Moyen / Pas bien), `Choix unique`, `Choix multiple`, `Texte` (plusieurs lignes), `Texte court` (une ligne). |
| **Réponses possibles** | Pour les choix : `Non ; Oui` (séparées par `;`). `[Classes]` ou `[Matières]` reprennent les listes de Config. |
| **Obligatoire** | Cocher si la question doit avoir une réponse. |
| **Précisez si** | Réponses qui font apparaître un champ « Précisez » (`Oui`, ou `Moyen ; Pas bien`). Vide sur une échelle : Moyen et Pas bien. `aucune` pour ne jamais l'afficher. |
| **Afficher si** | Question visible seulement selon une réponse précédente : `difficultes = Oui` (identifiant ou texte d'une question placée **avant**). `niveau = 4e ; 3e` selon la classe. |
| **Aide** | Petite phrase sous la question. |
| **Libellé de « Précisez »** | Remplace « Précisez si vous le souhaitez » pour cette question. |
| **Max caractères** | Longueur maximale d'un texte (1000 par défaut). |
| **Identifiant** | Rempli à la publication : c'est le nom de la colonne dans `Reponses_Parents`. |

Règles à respecter une fois des réponses reçues :

- **Ne pas modifier un identifiant** : les réponses suivantes iraient dans une nouvelle colonne.
  Reformuler la question (colonne Question) ne pose aucun problème.
- **Ne pas réutiliser une ligne pour une tout autre question** : effacer son identifiant ou en
  créer une nouvelle ligne, sinon anciennes et nouvelles réponses se mélangent dans la même colonne.
- Pour retirer une question, cochez **Masquer** plutôt que supprimer la ligne. Dans les deux cas, la
  colonne et ses réponses restent dans le Sheet : le script ne supprime jamais de colonne.
- Les colonnes de `Reponses_Parents` peuvent être réordonnées : le script les retrouve par leur
  identifiant.

Les deux premières questions (classe et nom de l'enfant) sont fixes et ne figurent pas dans l'onglet.

## Mettre à jour la synthèse

Dans le Sheet : **APE > Mettre à jour la synthèse**. À relancer avant chaque conseil.

- Onglet **`Synthese`** : nombre de réponses par classe.
- Un onglet **`Synthese 6e A`** (etc.) par classe ayant au moins une réponse :
  - les 5 points « Pas bien » les plus cités ;
  - par thème, la répartition en % sur l'échelle Très bien / Bien / Moyen / Pas bien ;
  - la répartition des réponses aux questions à choix ;
  - les commentaires et précisions, **sans les noms**, triés par ordre alphabétique (l'ordre
    d'arrivée ne permet pas de recouper les réponses d'une même personne).
- Les onglets `Synthese …` sont recréés à chaque mise à jour : ne pas écrire dedans.
- Imprimer : **Fichier > Imprimer > Ajuster à la largeur**.
- **Relire les commentaires** avant le conseil : un texte libre peut contenir un prénom.

## Installation (déjà faite pour 2026-2027)

Pour une nouvelle année ou un nouveau classeur :

1. Créer le Sheet et son script. Depuis `apps-script/` :
   `clasp --user ape create --type sheets --title "Conseil de classe – réponses AAAA-AAAA" --rootDir .`,
   puis `git checkout appsscript.json` (car `clasp create` l'écrase), puis `clasp --user ape push --force`.
   Sans clasp : **Extensions > Apps Script** dans un Sheet vide, coller `Code.gs`, et coller
   `appsscript.json` (Paramètres du projet > Afficher le fichier manifeste).
2. Dans le Sheet : **APE > Installer / réparer le classeur**, puis autoriser le script (« application
   non validée » > Paramètres avancés > Accéder à…). Les onglets sont créés avec les questions de
   départ, puis publiés.
3. Déployer : `clasp --user ape create-deployment --description "v1"` (ou **Déployer > Nouveau
   déploiement > Application web**, exécuter en tant que *Moi*, accès *Tout le monde*). L'URL
   `/exec` doit afficher `{"status":"ok"}`.
4. Sur GitHub : **Settings > Secrets and variables > Actions > Variables** :
   `VITE_APPS_SCRIPT_URL` = l'URL `/exec`, puis **Actions > Run workflow**.

GitHub Pages est configuré avec la source « GitHub Actions » : chaque push sur `main` lance les tests
puis republie le site.

## Mettre à jour le script

Après une modification de `Code.gs` : `clasp --user ape push --force`, puis mettre à jour le
**même** déploiement, pour que l'URL reste la même :
`clasp --user ape update-deployment AKfycbwu0_-QOC5RD9gkHpbL0ftg7bmdh74bgXNO__sfIMIQwEoMG8IX6QkXQGb0-YhZJOX1cg -d "description"`.
Dans l'éditeur, c'est **Déployer > Gérer les déploiements > Modifier > Nouvelle version**. Ne pas
créer un nouveau déploiement, sinon l'URL change.

Modifier les questions ne demande **pas** de redéployer le script.

Pour tester l'API : `curl -sL "<URL>?action=questionnaire"` et `curl -sL --data '…' <URL>`, jamais
`curl -X POST -L`. Avec `-X POST`, curl renvoie un POST sur la redirection de Google : il affiche
une page d'erreur alors que la ligne a **déjà** été écrite.

## Développement local

```bash
npm install
npm run dev        # http://localhost:5173 : sans .env, questions d'exemple et envoi simulé
npm test           # construction depuis l'onglet, fonctions du script, parité front / script
npm run build
npm run exemple    # régénère src/dev/questionnaire-exemple.json après modification des questions de départ
```

Pour tester en local contre le vrai Sheet, mettre `VITE_APPS_SCRIPT_URL=<URL /exec>` dans `.env`.
Attention : les réponses envoyées arrivent alors dans le Sheet.

## Confidentialité

- Aucun cookie, aucun traceur, aucune statistique de visite. Les polices sont servies par le site
  lui-même (pas de Google Fonts).
- Le site ne peut lire que les **questions** publiées (`?action=questionnaire`), jamais les
  réponses. Seules les personnes qui ont accès au Sheet les voient : partagez-le seulement avec
  les délégués et le bureau.
- Le nom de l'enfant est facultatif et n'apparaît jamais dans les onglets `Synthese`.
- Le brouillon est gardé dans `sessionStorage` : il disparaît à la fermeture de l'onglet, ce qui
  compte sur un appareil partagé. L'indicateur « déjà répondu » (`localStorage`) est un simple confort.
- Côté serveur : taille maximale de la requête, types et longueurs vérifiés, réponses masquées
  ignorées, champ piège anti-robot, verrou d'écriture, identifiant de réponse anti-doublon, textes
  neutralisés pour ne jamais devenir des formules.
- **Fin d'année** : supprimer les lignes de `Reponses_Parents` et les onglets `Synthese …` (ou tout
  le classeur) avant la date annoncée sur la page d'accueil (onglet Config).

## Choix faits par défaut (à valider)

- **Parents uniquement**, une réponse par enfant : chaque enfant est rattaché à sa classe pour le
  conseil. À la fin, un bouton « Répondre pour un autre enfant » relance un formulaire vierge.
- **Publication explicite** (menu) plutôt qu'en direct : une modification en cours dans l'onglet ne
  casse jamais le formulaire en ligne.
- Contact `ape.queneau@gmail.com`, date du conseil (« décembre 2026, dates à confirmer ») et classes
  (6e A-D, 5e A-C, 4e A-D, 3e A-C) : à vérifier dans `Config`.
- Le site s'affiche en **thème clair uniquement** et suit la charte APE v1 (Oswald / Quicksand, bleu
  canard, jaune, vert, texte noir sur les aplats de couleur).
