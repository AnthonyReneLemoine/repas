# Préparation de la migration du Tableau des repas

## Source
- Dépôt : `AnthonyReneLemoine/repas`
- Branche de production : `main` (à conserver intacte)
- Branche de préparation : `ameliorations-repas-2026-11`
- Site : https://anthonyrenelemoine.github.io/repas/

## Fonctionnalités existantes à conserver
- Authentification Firebase et contrôle d'accès
- Planning hebdomadaire (lundi à dimanche) avec petit-déjeuner, déjeuner et dîner
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
