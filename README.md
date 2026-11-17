# Appli recettes

Web app installable sur Android (Chrome) pour choisir ses recettes, planifier les repas de la semaine
et, dans les phases suivantes, générer la liste de courses.

## Phase 2 (cette version)
- Semaine : matin / midi / soir, semaine suivante, appui long (déplacer, copier, restes, vider), repas dehors, « Reprendre la semaine dernière »
- Mois : calendrier avec les repas prévus
- Mes recettes : recherche (nom ou ingrédient), filtres en pastilles, favoris
- Fiche recette : portions ajustables, annotations, mode cuisine (écran allumé, minuteurs)
- Ajout : saisie, photo compressée, texte collé découpé automatiquement, lien reçu par « Partager »
- Mise à jour 1 : semaine en grille qui tient sur l'écran (touchez un jour pour le détail), corbeille sur chaque repas,
  lecture du texte d'une photo de recette (Tesseract, chargé à la demande) qui remplit les champs
- Courses (onglet du menu) : ingrédients de la semaine additionnés et ajustés aux portions, rangés en
  Fruits / Légumes / Viande et poisson / Autres, cases à cocher, export « Partager » ou « Copier » vers une note
- Import depuis un lien (`src/lib/lien.ts`) : données schema.org « Recipe » de la page (titre, photo, portions, temps,
  ingrédients, étapes), page récupérée via le relais public r.jina.ai (repli : allorigins, corsproxy), photo via wsrv.nl.
  Un lien partagé depuis Chrome vers l'appli est importé automatiquement.
- Lecture de photo (`src/lib/ocr.ts`, `src/lib/fiche-photo.ts`) : Tesseract en mode « texte épars », mise en page
  refaite à partir de la position des mots (lignes, colonnes, bandes, paragraphes), puis chaque bloc reçoit un rôle
  (titre, ingrédients, étapes, ignorer) selon le plan d'une fiche recette ; l'utilisateur peut corriger avant de remplir.
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
