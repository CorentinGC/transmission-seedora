Mets à jour le fichier README.md du projet pour refléter l'état actuel de l'application après les changements récents.

## Étapes

1. **Analyser les changements récents** — Lis les derniers commits avec `git log --oneline -20` pour identifier les ajouts, modifications ou suppressions significatifs depuis la dernière mise à jour du README.

2. **Vérifier l'état actuel du code** — Parcours la structure du projet pour détecter :
   - Nouveaux dossiers ou fichiers importants
   - Nouvelles dépendances dans `package.json`
   - Nouveaux scripts npm
   - Nouvelles langues dans `src/renderer/locales/`
   - Changements dans l'arborescence `src/`

3. **Mettre à jour le README** en appliquant les changements nécessaires :
   - **Features** — Ajouter/modifier/supprimer les fonctionnalités listées
   - **Tech Stack** — Ajouter/supprimer les technos si des dépendances ont changé
   - **Project Structure** — Mettre à jour l'arborescence si la structure a évolué
   - **Getting Started** — Mettre à jour les prérequis ou commandes si nécessaire
   - **Contributing** — Ajouter de nouvelles conventions ou tips si pertinent

4. **Ne pas toucher** aux sections suivantes sauf si explicitement demandé :
   - Le paragraphe d'introduction ("Why this project?")
   - License & Acknowledgments

5. **Résumer les modifications** — Liste les sections du README qui ont été mises à jour et pourquoi.

## Règles

- Ne pas inventer de fonctionnalités — ne documenter que ce qui existe dans le code
- Garder le même style et format que le README existant
- Être concis — le README doit rester lisible et pas trop long
- Si aucun changement n'est nécessaire, le signaler au lieu de faire des modifications inutiles
