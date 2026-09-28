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
    models/           # schémas Mongoose (Account, Category, Transaction)
    routes/           # routes REST /api/*
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

Les montants sont stockés en **cents** (entiers) pour éviter les erreurs d'arrondi.
Une transaction positive est un revenu, une négative une dépense.
