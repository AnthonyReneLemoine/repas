# Préparation de la migration du Tableau des repas

## Source
- Dépôt : `AnthonyReneLemoine/repas`
- Branche de production : `main` (à conserver intacte)
- Branche de préparation : `ameliorations-repas-2026-11`
- Site : https://anthonyrenelemoine.github.io/repas/

## Fonctionnalités existantes à conserver
- Authentification Firebase et contrôle d'accès
- Planning hebdomadaire (lundi à dimanche) avec déjeuner et dîner, et export SMS des dîners de la semaine ou des jours restants
- Glisser-déposer des repas
- Fiches repas, recherche et archivage
- Synchronisation Firestore

## Améliorations envisagées
- Fiches recettes détaillées avec ingrédients, portions et étapes
- Filtres Thermomix TM5 / Air Fryer / four / faitout
- Liste de courses générée à partir du planning
- Export PDF A4 et sauvegarde JSON
- Guide des temps de cuisson Air Fryer
- Interface adaptée au mobile

## Conditions de migration
La publication sur ChatGPT Sites n'est pas réalisée par ce dépôt. Vérifier les possibilités d'importation, d'hébergement, de connexion à Firebase et de stockage persistant sur la destination avant de publier.

Ne pas copier de mot de passe ni de clé privée dans ce dépôt. La configuration Web Firebase publique n'est pas une règle de sécurité : conserver les règles Firestore et les restrictions d'accès côté serveur.

## Validation avant mise en production
1. Tester sur une URL de prévisualisation distincte.
2. Vérifier la connexion et les droits d'accès.
3. Vérifier la lecture et l'écriture Firestore sans altérer les données existantes.
4. Tester le planning, l'archivage et les exports sur ordinateur et mobile.
5. Ne fusionner sur `main` qu'après validation.

## Version privée de test du 18 novembre 2026

Le site démarre avec deux recettes d’exemple. Cet essai se conserve dans le navigateur.
« Connecter Firebase » utilise la configuration Web de repas-70a80 et le compte déjà autorisé.
Le site lit les fiches de meals et les plannings de weekPlans, y compris les anciens dîners.
Les changements connectés utilisent des documents distincts dans weekPlans, avec le préfixe
essai-sites-v1-. Le site d’origine continue à utiliser ses propres identifiants.
Les règles Firestore du dépôt sont conservées. Une opération de plus de 450 documents
est refusée en entier.

Les quantités des fiches et de la liste de courses sont réglables pour une, deux ou quatre
personnes. Les ingrédients portant le même nom et la même unité sont cumulés pour
chaque occurrence de la recette. La liste indique les fiches qui restent à compléter.
Le guide Moulinex reprend 19 entrées du document cuisson_air_fryer.pdf du 5 novembre.
Les commandes d’impression ouvrent le dialogue du navigateur au format A4.

La sauvegarde JSON contient les fiches, les archives et toutes les semaines de l’essai
actif. L’import valide le fichier avant de fusionner les données. Les identifiants
communs sont remplacés après confirmation.

### Lancer la version de test

Avec Node.js 24, lancer `node --test tests/migration.test.mjs`, puis `node build.mjs`.
Servir le répertoire dist avec un serveur HTTP local. Le dépôt conserve également
index.html à la racine. Le site privé de test est accessible à l’adresse
https://tableau-repas-anthony-test.alemoine.chatgpt.site.
