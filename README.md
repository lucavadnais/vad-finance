# Finance

Application personnelle de gestion de finances, entièrement conteneurisée avec Docker.

## Stack

| Conteneur | Contenu                                                         | Port local   |
| --------- | --------------------------------------------------------------- | ------------ |
| `app`     | Frontend (Vue 3 + TypeScript + Vite, Tailwind v4, shadcn-vue) + backend (Node.js + Express 5) | 5173, 3000 |
| `mongo`   | MongoDB 8 (via Mongoose)                                         | 27017        |

Le conteneur `app` contient tout le projet (`/workspace`) et lance le frontend et le backend ensemble. Il sert aussi de Dev Container pour VS Code.

## Démarrage

Prérequis : [Docker Desktop](https://www.docker.com/products/docker-desktop/).

### Avec VS Code (recommandé)

1. Installer l'extension **Dev Containers** (`ms-vscode-remote.remote-containers`).
2. `Ctrl+Shift+P` → **Dev Containers: Reopen in Container**.

VS Code démarre les conteneurs et s'ouvre dans `app` : chaque terminal est dans le conteneur, avec Node, npm et `mongosh`.

### En ligne de commande

```bash
docker compose up --build
```

- Application : http://localhost:5173
- API : http://localhost:3000/api/health
- Base de données : `mongodb://localhost:27017/finance` depuis Windows (ex. [MongoDB Compass](https://www.mongodb.com/products/tools/compass)), `mongodb://mongo:27017/finance` depuis le conteneur. Sans mot de passe, accessible uniquement depuis cette machine.

Les dépendances npm sont installées automatiquement à chaque démarrage du conteneur, et le code est rechargé à chaque modification.

### Connexion avec Google

Chaque utilisateur se connecte avec son compte Google et ne voit que ses propres données. Pour l'activer :

1. Dans la [Google Cloud Console](https://console.cloud.google.com/apis/credentials) : **Créer des identifiants → ID client OAuth → Application Web**.
2. **Origines JavaScript autorisées** : `http://localhost`, `http://localhost:5173`, `http://localhost:3000`, plus l'adresse HTTPS de production (ex. celle de Tailscale). Google refuse les adresses en HTTP autres que `localhost` : depuis un téléphone sur le réseau local en HTTP, la connexion ne fonctionne pas.
3. Créer un fichier `.env` à la racine du projet (ignoré par git) :
   ```bash
   GOOGLE_CLIENT_ID=123456789-abc.apps.googleusercontent.com
   ```
4. Redémarrer les conteneurs : `docker compose up -d` (VS Code : **Dev Containers: Rebuild Container**).

Le backend vérifie le jeton remis par Google (signature, destinataire, expiration), puis ouvre une session de 30 jours, prolongée à l'usage : un cookie `httpOnly` (illisible par les scripts de la page), `SameSite=Lax` et `Secure` en HTTPS. Seule l'empreinte SHA-256 du jeton de session est enregistrée en base.

Chaque document (compte, transaction, catégorie…) porte le `user` à qui il appartient, et chaque requête filtre dessus. Les modèles refusent toute requête qui ne nomme pas d'utilisateur (`backend/src/lib/owned.js`). Un identifiant envoyé par le client (compte d'une transaction, groupe d'une catégorie…) doit aussi appartenir à l'utilisateur.

Dans **Paramètres → Profil**, l'utilisateur peut supprimer son compte (`DELETE /api/users/me`) : toutes ses données, ses sessions et l'utilisateur lui-même sont effacés définitivement, après avoir saisi son adresse pour confirmer.

#### Utilisateur de test (local)

Avec `DEV_LOGIN=1` dans le fichier `.env`, la page de connexion affiche « Se connecter comme utilisateur de test » : connexion sans Google avec l’utilisateur `test@example.com`, créé sans données à sa première connexion. Redémarrez les conteneurs après l'avoir ajouté. À n'activer que sur votre machine : n'importe qui ouvrant l'application (y compris par Tailscale) pourrait l'utiliser.

### Commandes utiles

Dans le terminal du conteneur (`docker compose exec app bash` hors VS Code) :

```bash
mongosh mongodb://mongo:27017/finance      # shell MongoDB
cd frontend && npx shadcn-vue@latest add card  # ajouter un composant shadcn-vue
cd frontend && npm run typecheck             # vérifier les types (aussi lancé par npm run build)
cd backend && npm install <paquet>         # ajouter une dépendance
```

Depuis Windows :

```bash
docker compose logs -f app     # logs du frontend et du backend
docker compose restart app     # redémarrer frontend + backend
docker compose down            # arrêter
docker compose down -v         # arrêter ET effacer les données MongoDB
```

### Installer comme application (webapp)

Le frontend est une PWA (`vite-plugin-pwa`) : manifeste, icônes générées depuis `frontend/public/logo.svg` (voir `frontend/pwa-assets.config.ts`) et service worker qui met en cache l'application, jamais les données de l'API. Le service worker n'existe que dans le build. Dès que `frontend/dist` existe, le backend sert l'application avec l'API sur un seul port. Celui que le conteneur démarre suffit, sans autre commande :

```bash
npm run build    # compile le frontend dans frontend/dist → http://localhost:3000
```

Relancez `npm run build` pour mettre à jour l'application installée. En développement, utilisez toujours http://localhost:5173. `npm start` lance le backend sans nodemon, pour une machine qui ne fait pas tourner `npm run dev`.

- **iPhone** : Safari → Partager → « Sur l'écran d'accueil ».
- **Android / ordinateur** : Chrome → « Installer l'application ». Chrome exige HTTPS (ou `localhost`) ; depuis un téléphone sur le réseau local en HTTP, seul l'ajout à l'écran d'accueil d'iOS fonctionne. Pour un accès HTTPS limité à vos appareils, placez le port 3000 derrière [Tailscale](https://tailscale.com/kb/1312/serve) (`tailscale serve 3000`). Pour une exposition publique, servez-la en HTTPS.

Les composants shadcn-vue sont générés dans `frontend/src/components/ui/` et s'importent via l'alias `@` (`import { Button } from '@/components/ui/button'`).

## Structure

```
.devcontainer/        # configuration Dev Container VS Code
Dockerfile            # image du conteneur app
package.json          # scripts `setup` et `dev` (lance backend + frontend)
backend/
  src/
    index.js          # point d'entrée Express
    db.js             # connexion MongoDB
    models/           # schémas Mongoose (User, Session, Account, Category, Transaction…)
    routes/           # routes REST /api/*
    lib/auth.js       # sessions (cookie) et middleware requireAuth
    lib/owned.js      # isolation des données par utilisateur
frontend/
  src/
    App.vue           # interface principale
    components/       # composants Vue (import CSV, formulaires…)
    components/ui/    # composants shadcn-vue générés
    api.ts            # client HTTP vers l'API
    types.ts          # types des données renvoyées par l'API
```

## API

| Méthode             | Route                   | Description                                        |
| ------------------- | ----------------------- | -------------------------------------------------- |
| GET                 | `/api/health`           | Vérification de l'état                             |
| GET                 | `/api/auth/config`      | Client ID Google pour le bouton de connexion       |
| POST                | `/api/auth/google`      | Connexion : `{ credential }` (jeton Google) → ouvre la session |
| GET                 | `/api/auth/me`          | Utilisateur connecté, ou 401                       |
| POST                | `/api/auth/logout`      | Ferme la session                                   |
| GET / POST          | `/api/accounts`         | Comptes (avec solde calculé)                       |
| PUT / DELETE        | `/api/accounts/:id`     |                                                    |
| GET / PUT / DELETE  | `/api/accounts/:id/logo` | Image du compte (PUT : le fichier brut, PNG/JPEG/WebP/GIF, 1 Mo max) |
| GET / POST          | `/api/categories`       | Catégories (`income` / `expense`)                  |
| PUT / DELETE        | `/api/categories/:id`   | `{ group: <id> \| null }` pour changer de groupe   |
| GET / POST          | `/api/category-groups`  | Groupes de catégories (ex. « Milieu de vie »)      |
| PUT / DELETE        | `/api/category-groups/:id` | Supprimer un groupe garde ses catégories        |
| GET / POST          | `/api/transactions`     | Filtres : `?account=<id>&from=YYYY-MM-DD&to=...` ; recherche : `?q=` (description, compte, catégorie ou montant, sans casse ni accents) ; pagination : `?page=1&pageSize=25` → `{ items, total, page, pageSize }` |
| PUT / DELETE        | `/api/transactions/:id` |                                                    |
| POST                | `/api/transactions/check-duplicates` | Doublons possibles de transactions pas encore enregistrées |
| GET                 | `/api/duplicates`       | Paires de transactions enregistrées en double possible |
| POST                | `/api/duplicates/ignore` | « Pas un doublon » (`{ ids: [a, b] }`)            |
| GET                 | `/api/transfers/candidates` | Paires probables à rapprocher en transfert     |
| POST                | `/api/transfers`        | Crée les deux côtés d'un transfert entre comptes   |
| POST                | `/api/transfers/link`   | Lie deux transactions existantes (`{ ids: [a, b] }`) |
| POST                | `/api/transfers/ignore` | Ne plus proposer une paire                         |
| DELETE              | `/api/transfers/link/:id` | Délie les deux côtés                             |
| GET / POST          | `/api/projections`      | Prévisions : dépenses prévues (`kind: expense`) et comptes à recevoir (`income`), un jour du mois, `recurrence` `monthly` / `yearly` (+ `month`) / `once` (+ `month`, `year`), `endDate` facultative (récurrentes), catégorie facultative |
| PUT / DELETE        | `/api/projections/:id`  | PUT remplace toute la prévision                    |

Toutes les autres routes demandent une session (sinon 401) et ne voient que les données de l'utilisateur connecté.

Les montants sont stockés en **cents** (entiers) pour éviter les erreurs d'arrondi.
Une transaction positive est un revenu, une négative une dépense.
