# Suivi de projets HTML utilitaires

Ce dépôt regroupe des mini-applications orientées productivité, affichant dynamiquement des informations utiles à l’organisation du temps de travail.

---

## Applications mobiles (React Native)

- **Organisation le matin**
  Application permettant de structurer les tâches matinales avec une liste interactive et persistante.
  Utilisation de Redux Toolkit, redux-persist, et react-native-draggable-flatlist.

- **Pomodoro React Native**
  Minuteur basé sur la méthode Pomodoro, conçu pour rester simple et agréable à utiliser.
  Interface épurée adaptée aux écrans tactiles.

- **Temps de sommeil restant**
  Deux variantes affichant le temps restant avant une heure de réveil définie.
  Les couleurs de fond changent selon la durée restante, avec un état stocké localement.

- **Temps restant**
  Affiche le temps avant un événement précis, mise à jour en temps réel.
  Interface minimale, lisible rapidement.

- **Heure de réveil (React Native)**
  Affichage direct de l’heure cible de réveil avec un fond visuel simple.
  Projet Expo avec navigation minimale.

## Applications web (HTML/CSS/JS Vanilla)

- **Organisation le matin (Web)**
  Variante web légère pour visualiser les priorités matinales.

- **Pomodoro (Web)**
  Version navigateur du minuteur Pomodoro, pensée pour les postes de travail.

- **Temps de sommeil restant (Web)**
  Affichage du temps restant avant le réveil à partir d’une heure saisie par l’utilisateur.

- **Temps restant (Web)**
  Décompte dynamique jusqu’à un événement à venir, lisible sur écran fixe.

- **Heure de réveil (Web)**
  Affichage simple de l’heure de réveil cible avec fond visuel statique.

- **Tracker de temps (Web)**
  Suivi basique du temps passé par tâche via un compteur dans le navigateur.

- **Gestion (Web)**
  Application à onglets pour organiser des ressources/événements. Actuellement 3 onglets actifs :
  1. **Ascenseurs** – Paramétrage (nombre/capacité/étages), génération de groupes, et calcul d’une séquence “quasi-optimale” via heuristique avec KPI (attente, remplissage).
  2. **Covoiturage** – Définition d’un trajet multi-escales (origine, escales, destination), gestion des voitures (capacité), répartition automatique des groupes et plan détaillé.
  3. **Calendrider personnel** – Calendrier local multi-profils avec événements, sous-tâches et commentaires, navigation mensuelle et persistance locale.
  Architecture : JavaScript “vanilla” (ES5) en MVC artisanal, Bootstrap 5, utilitaires UI maison.

---
