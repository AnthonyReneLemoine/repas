# Dashboard cuisine (GitHub Pages + Firebase)

Application web statique type Trello/Keep pour planifier les dîners de la semaine par glisser-déposer.

## Fonctionnalités

- Authentification Firebase avec email + mot de passe.
- Bouton de déconnexion.
- Colonnes hebdomadaires (`Lundi` à `Dimanche`) avec zones de dépôt.
- Liste des repas avec création, modification, suppression, archivage/désarchivage.
- Glisser-déposer :
  - depuis la liste des repas vers un jour,
  - entre les jours,
  - retour vers la liste pour retirer un repas d'un jour.
- Persistance temps réel dans Firestore.
- Compatible déploiement GitHub Pages (100% front statique).

## 1) Créer Firebase

1. Crée un projet Firebase.
2. Active **Authentication** > méthode **Email/Password**.
3. Active **Cloud Firestore**.
4. Dans `Project settings > General > Your apps`, crée une app Web.
5. Copie la config Firebase (objet JSON).

### Règles Firestore de départ (exemple)

> Exemple simple : chaque utilisateur authentifié peut lire/écrire.

```txt
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

## 2) Lancer localement

Depuis ce dossier :

```bash
python3 -m http.server 4173
```

Puis ouvre http://localhost:4173.

Au premier lancement, une popup demande la config Firebase.
Tu peux coller soit l'objet JSON, soit le bloc JavaScript `const firebaseConfig = { ... }`.
Elle est stockée dans `localStorage` du navigateur.

## 3) Déployer sur GitHub Pages

1. Pousse ce dépôt sur GitHub.
2. `Settings > Pages`.
3. Source: `Deploy from a branch`.
4. Branche: `main` (ou ta branche), dossier `/ (root)`.

L'app est ensuite servie en statique.

## Structure des données Firestore

- Collection `meals`
  - `name: string`
  - `note: string`
  - `archived: boolean`
  - `createdAt: timestamp`
- Collection `weekPlans`
  - document `currentWeek`
  - champ `days`:

```json
{
  "Lundi": ["mealId1"],
  "Mardi": ["mealId2", "mealId3"]
}
```
