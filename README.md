# Suivi de projets HTML utilitaires

Ce dépôt regroupe des mini-applications orientées productivité, affichant dynamiquement des informations utiles à l’organisation du temps de travail.

---

- **FoodApp (React Native)** – Application de recettes avec navigation empilée + tiroir, favoris via Redux, fiches recettes et recherche.
- **Snake (React Native)** – Portage mobile du Snake “10 niveaux”, contrôles par gestes et D-pad, HUD dans un tiroir. Grille 24×24, 5 pommes/niveau, vitesses progressives.
- **Tracker de temps (React Native)** – Suivi quotidien multi-“cadres”, start/stop, renommage, remise à zéro, historique; persistance via AsyncStorage.
- **Temps de sommeil restant (React Native) – V2** – Heures semaine/week-end, bascule de mode, boîte colorée selon durée restante, état persistant (redux-persist), profils EAS/OTA.
- **Heure de réveil (React Native)** – Affichage de quatre heures projetées (+8h, +7h30, +6h30, +6h) avec rafraîchissement contrôlé par AppState.
- **AI_team (Web)** – Orchestrateur de “simu entreprise” (Express 5) : création/lecture de sprints, état de projet, endpoints `/api/*`, interface Bootstrap.
- **Mini-langage (Web/CLI)** – Interpréteur + runtime, API `/run`, stockage de programmes (liste/sauvegarde/chargement/suppression).
- **Snake (Web)** – Version navigateur “10 niveaux”.
- **Heure de réveil (Web)** – Affiche désormais quatre heures décalées, rafraîchies en continu, avec bouton “Actualiser”.
- **Gestion (Web)** – Ajout d’un 4ᵉ onglet “Optimiser des emploi du temps interdépendants” (placeholder) et itérations sur contrôleurs Ascenseurs/Covoiturage/Calendrier.
- **Cours Git avancé (Web)** – Page de cours + JSON pédagogique (fetch, pull --rebase, rebase, cherry-pick, revert, etc.).
- **Temps restant (Web)** – Ajout d’un exemple ciblé “affiche_temps_avant_Live_Code.html”.

---

## Applications mobiles (React Native)

- **Organisation le matin**
  Structuration des tâches matinales via liste interactive et persistante (Redux Toolkit, redux-persist, draggable list).

- **Pomodoro React Native**
  Minuteur Pomodoro simple et tactile (Expo/TS).

- **Temps de sommeil restant**
  • V1 : saisie de l’heure de réveil, calcul automatique, persistance Redux.
  • V2 : modes semaine/week-end, couleurs selon durée, redux-persist, profils EAS.

- **Temps restant**
  Décompte jusqu’à plusieurs créneaux (cartes synthétiques), UI sobre sur Expo.

- **Heure de réveil**
  Affichage direct de l’heure cible et des projections (+8h, +7h30, +6h30, +6h).

- **Tracker de temps**
  Suivi par “cadres” avec start/stop, renommage, reset, historique; stockage local AsyncStorage.

- **FoodApp**
  Recettes avec Drawer/Stack, favoris Redux, fiches détaillées, recherche et cartes visuelles.

- **Snake**
  Snake “10 niveaux” avec gestes, D-pad, vitesses et obstacles progressifs.

---

## Applications web (HTML/CSS/JS Vanilla)

- **Organisation le matin (Web)**
  Variante légère pour visualiser les priorités matinales.

- **Pomodoro (Web)**
  Minuteur Pomodoro pour le navigateur.

- **Temps de sommeil restant (Web)**
  Affichage du temps restant avant le réveil après saisie de l’heure.

- **Temps restant (Web)**
  Décompte dynamique jusqu’à un événement; inclut un exemple “Live Code”.

- **Heure de réveil (Web)**
  Quatre heures projetées (+8h, +7h30, +6h30, +6h), rafraîchies chaque seconde.

- **Tracker de temps (Web)**
  Compteur simple du temps passé par tâche.

- **Gestion (Web)**
  Application à onglets pour organiser des ressources/événements.
  1) **Ascenseurs** – Paramétrage (nombre/capacité/étages), génération de groupes, heuristique “quasi-optimale” + KPI; contrôleurs affinés.
  2) **Covoiturage** – Trajet multi-escales, gestion des voitures, répartition automatique, plan détaillé.
  3) **Calendrider personnel** – Événements, sous-tâches, commentaires, navigation mensuelle, persistance locale (UI/contrôleurs enrichis).
  4) **Optimisation interdépendante** – Préparation d’un module d’optimisation multi-plannings.
  Architecture : JavaScript “vanilla” (ES5) en MVC artisanal, Bootstrap 5, utilitaires UI maison.

- **AI_team**
  Orchestrateur de sprint d’équipe (Chef/Manager/Dev/Graphiste), endpoints Express pour démarrer/enchaîner/pause/fin de sprint; interface Bootstrap.

- **Mini-langage**
  Interpréteur + runtime avec API `/run` et UI web; persistance fichiers (liste/sauvegarde/chargement/suppression).

- **Snake (Web)**
  Version navigateur “10 niveaux”.

- **Cours Git avancé**
  Page cours et référentiel JSON des commandes avancées (fetch, pull --rebase, rebase, cherry-pick, revert, reset, etc.).
