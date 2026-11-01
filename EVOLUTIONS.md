# Évolutions prévues

Objectif à terme : une application dédiée parents / enfants, avec des comptes, des notifications,
des retours après le conseil de classe et un historique par trimestre. Voici ce que l'architecture
actuelle permet déjà de garder, et ce qu'il faudra changer.

## Ce qui se réutilise tel quel

- **Le format du questionnaire publié** (réponse de `?action=questionnaire`) ne dépend ni de React
  ni de Google. Une future application, quel que soit son backend, peut servir le même JSON. Les
  identifiants de questions sont stables : c'est la clé pour comparer les trimestres.
- **L'onglet `Questions` comme outil d'édition** pour le bureau : `construireQuestionnaire_` (dans
  `Code.gs`) peut être porté tel quel vers un autre backend, ou conservé comme éditeur qui publie
  vers la nouvelle base.
- **`src/lib/questionnaire.js`** : règles d'affichage et de validation pures, sans DOM ni stockage.
  Réutilisable dans une application mobile (React Native) ou côté serveur Node.
- **Le payload envoyé** (`questionnaire`, `version`, `id`, `reponses`) est déjà le format d'une API.
  Une nouvelle API peut accepter le même corps : le front change seulement d'URL (`VITE_APPS_SCRIPT_URL`).
- **Composants d'interface** (étapes, questions, accessibilité, charte) : indépendants du backend.
- **Plusieurs questionnaires** : les données gardent la forme `questionnaires: { parents: … }`.
  Un questionnaire élèves pourra être ajouté à côté, avec son propre onglet de questions.

## Ce qu'il faudra ajouter

| Besoin | Piste |
|---|---|
| Historique par trimestre | Ajouter une `periode` (ex. `2026-T1`) dans Config, le questionnaire publié et le payload ; une colonne de plus dans le Sheet suffit au début. La synthèse filtre par période. |
| Comptes parents / enfants | Quitter Apps Script pour une vraie base (Postgres, ou Supabase / Firebase) avec authentification. Un compte parent rattaché à un ou plusieurs enfants ; si un questionnaire élèves revient, un compte enfant **distinct**, dont le parent ne voit pas les réponses. |
| Retours après le conseil | Une table « compte rendu » par classe et période, rédigée par les délégués, visible des familles de la classe. |
| Notifications | E-mail d'abord (rappel avant le conseil, compte rendu publié), notifications push si application mobile. |
| Migration des données | L'onglet `Reponses_Parents` s'exporte en CSV, une ligne par réponse, une colonne par `id` : import direct dans une table `reponses(id, questionnaire, periode, classe, question_id, valeur)`. |

## Points d'attention

- **RGPD** : avec des comptes, les réponses ne sont plus anonymes. Il faudra une analyse
  (registre, information, consentement des parents pour les moins de 15 ans, durée de
  conservation par trimestre) et séparer techniquement l'identité des réponses si l'on veut garder
  une synthèse anonyme.
- **Coût et maintenance** : l'APE n'a ni budget ni équipe technique permanente. Préférer un service
  hébergé gratuit et une base simple, plutôt qu'un serveur à administrer.
- Garder la règle « une question = un `id` stable » : c'est ce qui rend l'historique possible.
