# Appli recettes

Web app installable sur Android (Chrome) pour choisir ses recettes, planifier les repas de la semaine
et, dans les phases suivantes, générer la liste de courses.

## Phase 2 (cette version)
- Semaine : matin / midi / soir, semaine suivante, appui long (déplacer, copier, restes, vider), repas dehors, « Reprendre la semaine dernière »
- Mois : calendrier avec les repas prévus
- Mes recettes : recherche (nom ou ingrédient), filtres en pastilles, favoris
- Fiche recette : portions ajustables, annotations, mode cuisine (écran allumé, minuteurs)
- Ajout : saisie, photo compressée, texte collé découpé automatiquement, lien reçu par « Partager »
- Réglages : nom, thématiques, portions par défaut, export / restauration
- Données stockées sur le téléphone (IndexedDB), fonctionne hors ligne

La DA est provisoire : couleurs, polices et tailles sont dans `src/index.css` (variables en tête du fichier).

## Développement
```
npm install
npm run dev        # http://localhost:5173
npm run build      # dossier dist/
npx tsx tests/quantites.test.ts
node tests/e2e.cjs <dossier-captures> <photo.png>   # avec dist servi sur BASE
```

## Mise en ligne
Chaque envoi sur `main` publie l'appli sur GitHub Pages (`.github/workflows/deploy.yml`).
Réglage à faire une fois : Settings → Pages → Source : « GitHub Actions ».
