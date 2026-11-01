# Questionnaire conseil de classe – APE collège Raymond Queneau

Deux questionnaires en ligne, un pour les **élèves** et un pour les **parents**, à remplir avant le
conseil de classe. Les réponses arrivent dans un Google Sheet privé de l'APE. Une synthèse par
classe, sans les noms, est prête à imprimer pour les délégués de parents.

```
élève / parent ──▶ site statique (GitHub Pages) ──POST──▶ Apps Script (application web) ──▶ Google Sheet
                         │                                       ▲
                         └── questionnaires.json ───── lu par ───┘   (une seule source pour les questions)
```

- Lien élèves : `https://<compte>.github.io/ape-conseil-classe/#/eleves`
- Lien parents : `https://<compte>.github.io/ape-conseil-classe/#/parents`
- Accueil (choix élève / parent et mention sur les données) : `https://<compte>.github.io/ape-conseil-classe/`

## Arborescence

```
ape-conseil-classe/
├── src/
│   ├── data/questionnaires.json   ← toutes les questions, classes, matières, date du conseil
│   ├── lib/questionnaire.js       ← règles d'affichage et de validation (pures, testées)
│   ├── lib/envoi.js               ← POST vers Apps Script (text/plain, sans requête CORS préalable)
│   ├── lib/stockage.js            ← brouillon (sessionStorage) et « déjà répondu » (localStorage)
│   ├── components/                ← Accueil, Questionnaire (étapes), Question, Merci, Entete
│   ├── App.jsx, main.jsx, styles.css (charte APE)
├── public/logo-ape.png            ← À AJOUTER (logo APE 2025)
├── apps-script/Code.gs            ← tout le backend (un seul fichier)
├── apps-script/appsscript.json
├── tests/                         ← node --test, aucune dépendance
├── .github/workflows/deploy.yml   ← tests + build + publication GitHub Pages
├── .env.example
└── EVOLUTIONS.md                  ← suite prévue (application parents / enfants)
```

## Mise en place pas à pas

À faire une fois, dans cet ordre (le script a besoin de l'adresse du site, et le site de l'adresse
du script).

### 1. Publier le site sur GitHub Pages

1. Créer un dépôt **public** `ape-conseil-classe` sur GitHub et y pousser ce dossier.
2. Ajouter le logo : copier le logo APE 2025 dans `public/logo-ape.png` (PNG, 320 px de large ou
   plus). Le logo actuel est un JPG sur fond blanc : il convient, car le site a un fond blanc.
   Depuis un Mac : `sips -s format png "Logo APE2025 couleurs.jpg" --out public/logo-ape.png`.
3. Sur GitHub : **Settings > Pages > Build and deployment > Source : GitHub Actions**.
4. Onglet **Actions** : le workflow « Tests et déploiement GitHub Pages » se lance à chaque push sur
   `main`. Une fois vert, le site est en ligne. Il affichera un avertissement tant que l'étape 4
   n'est pas faite, car l'envoi des réponses ne fonctionne pas encore.
5. Vérifier que `https://<compte>.github.io/ape-conseil-classe/questionnaires.json` s'affiche.

### 2. Créer le Google Sheet et coller le script

Avec le compte Google de l'APE (c'est lui qui « possède » les réponses) :

1. Créer un Google Sheet vide, par exemple « Conseil de classe – réponses 2026-2027 ».
2. **Extensions > Apps Script**. Remplacer le contenu de `Code.gs` par celui de
   [`apps-script/Code.gs`](apps-script/Code.gs).
3. **Paramètres du projet** (roue dentée) > cocher **Afficher le fichier manifeste
   « appsscript.json »**, puis remplacer son contenu par [`apps-script/appsscript.json`](apps-script/appsscript.json).
   Enregistrer.

*Variante clasp* : depuis `apps-script/`, `clasp create --parentId <ID_DU_SHEET>` (sans
`--type sheets`, qui créerait un nouveau classeur), puis `git checkout appsscript.json`, car
`clasp create` l'écrase, et enfin `clasp push`.

### 3. Installer le classeur

1. Recharger le Sheet : un menu **APE** apparaît (quelques secondes après l'ouverture).
2. **APE > Installer le classeur**. Coller l'adresse
   `https://<compte>.github.io/ape-conseil-classe/questionnaires.json` et autoriser le script.
   Google affiche « application non validée » : cliquer sur **Paramètres avancés > Accéder à… (non
   sécurisé)**. C'est normal pour un script personnel.
3. Les onglets `Config`, `Reponses_Eleves`, `Reponses_Parents` et `Synthese` sont créés. La
   ligne 1 des onglets de réponses contient les `id` des questions. Survolez un en-tête pour lire
   la question en entier.

### 4. Déployer l'application web

1. Dans l'éditeur Apps Script : **Déployer > Nouveau déploiement > type : Application web**.
   - Exécuter en tant que : **Moi**
   - Qui a accès : **Tout le monde**
2. Copier l'URL qui se termine par `/exec`.
3. Vérifier : ouvrir cette URL dans un navigateur affiche `{"status":"ok"}`, et rien d'autre.
4. Sur GitHub : **Settings > Secrets and variables > Actions > onglet Variables > New repository
   variable** : nom `VITE_APPS_SCRIPT_URL`, valeur l'URL `/exec`. Ce n'est pas un secret : l'URL est
   visible dans le site publié.
5. **Actions > Tests et déploiement GitHub Pages > Run workflow** pour republier le site avec l'URL.

### 5. Tester puis diffuser

1. Répondre une fois à chaque questionnaire sur le site publié et vérifier les lignes dans le Sheet.
2. **Supprimer ces lignes de test** avant de diffuser.
3. Diffuser le lien `#/eleves` aux élèves (Pronote, ENT) et le lien `#/parents` aux familles,
   séparément, pour que parents et enfants ne répondent pas sur la même page.

Pour tester l'API en ligne de commande, utiliser `curl -sL --data '…' <URL>`, jamais
`curl -X POST -L`. Avec `-X POST`, curl renvoie un POST sur la redirection de Google : il affiche
une page d'erreur alors que la ligne a **déjà** été écrite.

## Ajouter ou modifier une question

Tout se passe dans [`src/data/questionnaires.json`](src/data/questionnaires.json). Aucun code à
changer, ni dans le site ni dans le script.

1. Modifier le fichier. Pour chaque nouvelle version publiée, changer aussi `"version"` (par exemple
   la date du jour) : le script voit le changement et relit le fichier tout de suite.
2. `npm test` : le test vérifie le fichier (id uniques, types, options, conditions…).
3. Pousser sur `main` : le site est republié en 1 à 2 minutes.
4. Les colonnes des nouvelles questions apparaissent dans le Sheet à la première réponse. Pour les
   voir tout de suite : **APE > Recharger le questionnaire et les colonnes**.

Règles à respecter une fois des réponses reçues :

- **Ne jamais réutiliser un `id`** pour une autre question : les anciennes réponses resteraient dans
  sa colonne. Pour reformuler, changer seulement `libelle`.
- Supprimer une question la retire du formulaire, mais sa colonne reste dans le Sheet avec ses
  réponses. Le script ne supprime jamais de colonne.
- Les colonnes peuvent être réordonnées à la main dans le Sheet : le script les retrouve par leur `id`.

### Champs d'une question

| Champ | Obligatoire | Rôle |
|---|---|---|
| `id` | oui | Nom de la colonne dans le Sheet : minuscules, chiffres, `_` |
| `theme` | oui | `id` d'un thème du questionnaire (chaque thème est une étape) |
| `type` | oui | `echelle4`, `choix_unique`, `choix_multiple` ou `texte` |
| `libelle` | oui | Texte de la question |
| `obligatoire` | oui | `true` ou `false` |
| `options` | choix | Liste des réponses possibles |
| `liste` | choix | À la place de `options` : `"classes"` ou `"matieres"` (définies dans `listes`) |
| `precision_si` | non | Réponses qui font apparaître un champ « Précise ». Pour `echelle4`, vaut par défaut `precision_echelle4` (« Moyen », « Pas bien ») |
| `precision_libelle` | non | Libellé du champ de précision (sinon celui du questionnaire) |
| `afficher_si` | non | `{"niveau": ["4e","3e"]}` ou `{"question": "difficultes", "valeurs": ["Oui"]}`. Possible aussi sur un thème entier |
| `aide_si` | non | Message d'aide (et numéros) affiché pour certaines réponses |
| `aide` | non | Petite phrase d'aide sous la question |
| `max` | non | Longueur maximale d'un texte (1000 par défaut, 500 pour une précision) |
| `court` | non | Texte sur une ligne au lieu d'une zone de texte |
| `affichage` | non | `"liste"` : liste déroulante au lieu de boutons |
| `nominatif` | non | Le champ contient un nom : il n'apparaît jamais dans la synthèse |

Autres réglages du même fichier : `listes.classes` (format « 6e A »), `listes.matieres`,
`site.prochain_conseil` (affiché sur la page de remerciement), `site.contact`, `site.conservation`.

## Mettre à jour la synthèse

Dans le Sheet : **APE > Mettre à jour la synthèse**. À relancer avant chaque conseil.

- Onglet **`Synthese`** : nombre de réponses élèves et parents par classe.
- Un onglet **`Synthese 6e A`** (etc.) par classe ayant au moins une réponse. Pour chaque
  questionnaire, il contient :
  - les 5 points « Pas bien » les plus cités ;
  - par thème, la répartition en % sur l'échelle Très bien / Bien / Moyen / Pas bien ;
  - la répartition des réponses aux questions à choix (temps de devoirs, matières…) ;
  - les commentaires et précisions, **sans les noms**, triés par ordre alphabétique (l'ordre
    d'arrivée ne permet pas de recouper les réponses d'une même personne).
- Les onglets `Synthese …` sont effacés et recréés à chaque mise à jour : ne pas écrire dedans.
- Imprimer : **Fichier > Imprimer > Ajuster à la largeur**, sans quadrillage.
- **Relire les commentaires** avant le conseil : un texte libre peut contenir un prénom ou un
  détail qui identifie quelqu'un.

## Mettre à jour le script plus tard

Après une modification de `Code.gs`, l'URL `/exec` sert toujours l'ancienne version. Il faut faire
**Déployer > Gérer les déploiements > (crayon) Modifier > Version : Nouvelle version > Déployer**.
Ne pas créer un nouveau déploiement, sinon l'URL change et la variable `VITE_APPS_SCRIPT_URL` doit
être mise à jour.

Modifier une question ne demande **pas** de redéployer le script (voir plus haut).

## Développement local

```bash
npm install
cp .env.example .env      # facultatif : sans URL, l'envoi est simulé en local
npm run dev               # http://localhost:5173/#/eleves
npm test                  # validation du JSON, fonctions du script, parité front / script
npm run build             # produit dist/ (avec dist/questionnaires.json)
```

## Confidentialité

- Aucun cookie, aucun traceur, aucune statistique de visite. Les polices sont servies par le site
  lui-même (pas de Google Fonts).
- `doGet` ne renvoie que `{"status":"ok"}`. Aucune réponse n'est lisible depuis le site : seules
  les personnes qui ont accès au Sheet les voient. Partagez-le seulement avec les délégués et le
  bureau.
- Le nom est facultatif et n'apparaît jamais dans les onglets `Synthese`.
- Le brouillon est gardé dans `sessionStorage` : il disparaît à la fermeture de l'onglet, ce qui
  compte sur un appareil partagé. L'indicateur « déjà répondu » (`localStorage`) est un simple
  confort : il n'empêche pas de répondre à nouveau.
- Côté serveur : taille maximale de la requête, types et longueurs vérifiés, réponses masquées
  ignorées, champ piège anti-robot, verrou d'écriture, identifiant de réponse anti-doublon, textes
  neutralisés pour ne jamais devenir des formules.
- **Fin d'année** : supprimer les lignes des onglets `Reponses_*` et les onglets `Synthese …`
  (ou tout le classeur) avant le 31 août, comme annoncé sur la page d'accueil.

## Choix faits par défaut (à valider)

Les points mal définis dans la demande ont été tranchés au plus simple :

- **Questions lues par le script sur le site** (`questionnaires.json` publié avec le site, cache de
  6 h, relu dès que `version` change, copie de secours dans `Config!B5`). L'onglet `Config` affiche
  les classes et les matières, mais on les modifie dans le JSON : une seule source de vérité.
- **Classes** : celles de l'enquête APE (6e A-D, 5e A-C, 4e A-D, 3e A-C), à ajuster dans `listes.classes`.
- **Date du prochain conseil** : texte provisoire (« décembre 2026, dates à confirmer ») dans
  `site.prochain_conseil`.
- **Contact** : `ape.queneau@gmail.com`. À vérifier.
- **Obligatoire** : la classe et les questions de ressenti principales. Les textes libres, le
  rattrapage d'absence (pas concerné si jamais absent), le bien-être et l'orientation sont facultatifs.
- **Transport** : choix multiple (un élève peut venir à pied et en car).
- **Échelle** : appliquée telle quelle même aux questions de fréquence ou de fatigue. Les libellés
  ont été tournés pour que « Très bien » ait un sens (« Ta forme en fin de journée »).
- **Parents** : une réponse par enfant (texte d'aide en ce sens).
- **Bien-être** : le message et les numéros 3018 / 3020 s'affichent pour la réponse « Oui ».
- **Thème clair uniquement**, charte APE v1 (Oswald / Quicksand, bleu canard, jaune, vert, texte
  noir sur les aplats de couleur).
- Le **tutoiement** s'applique au questionnaire élèves. Le **vouvoiement** s'applique au questionnaire
  parents et à l'accueil.
