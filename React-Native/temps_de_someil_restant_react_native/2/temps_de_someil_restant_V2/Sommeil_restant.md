# Sommeil restant - Documentation

## Description

Application React Native / Expo permettant de visualiser le temps de sommeil restant avant l'heure de réveil programmée. L'app envoie des notifications pour rappeler à l'utilisateur qu'il est temps de se coucher.

## Fonctionnalites principales

- Affichage du temps restant avant le réveil
- Distinction semaine / week-end (horaires différents)
- Notifications de rappel pour aller dormir
- Persistance des réglages (Redux + AsyncStorage)
- Code couleur selon le temps restant :
  - Vert : >= 8h
  - Jaune : >= 6h
  - Rouge : >= 3h
  - Noir : < 3h

## Logique des notifications

### Declencheurs

Les notifications sont reprogrammées à chaque :
- Modification de l'heure de réveil
- Changement de mode (semaine/weekend)

### Offsets configures

3 notifications sont programmées avant l'heure de réveil :

| Offset | Temps avant réveil | Message |
|--------|-------------------|---------|
| -600 min | 10h | "Il vous reste 10h pour dormir 8h" |
| -510 min | 8h30 | "Il vous reste 8h30 pour dormir 8h" |
| -480 min | 8h | "Il vous reste 8h pour dormir 8h" |

### Exemple

Si l'heure de réveil est 06:30 :
- Notification 1 : 20:30 (veille)
- Notification 2 : 22:00
- Notification 3 : 22:30

### Flux de programmation

```
1. Annulation de toutes les notifications existantes
2. Calcul de la date de réveil :
   - Si l'heure est passée -> jour suivant
3. Pour chaque offset :
   - date_notif = date_réveil + offset (négatif)
   - Programmation via expo-notifications
```

### Code source (App.tsx)

```typescript
const OFFSETS_MIN = [-600, -510, -480];

const scheduleSleepNotifications = async (wakeDate: Date) => {
    for (const offset of OFFSETS_MIN) {
        const trigger = {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: new Date(wakeDate.getTime() + offset * 60_000),
        };
        await Notifications.scheduleNotificationAsync({
            content: {
                title: "Attention, il faut dormir",
                body: `Il vous reste ${Math.floor(Math.abs(offset) / 60)} h ${Math.abs(offset) % 60} min...`,
            },
            trigger,
        });
    }
};
```

## Permissions Android requises

- `INTERNET` : connexion réseau
- `VIBRATE` : vibration des notifications
- `SCHEDULE_EXACT_ALARM` : notifications à l'heure exacte (Android 12+)

**Important** : Sans `SCHEDULE_EXACT_ALARM`, les notifications peuvent être retardées de 10 min à 1h par le système (mode Doze).

## Structure du projet

```
temps_de_someil_restant_V2/
├── App.tsx              # Code principal
├── app.json             # Configuration Expo
├── package.json         # Dépendances
├── Makefile             # Commandes de build
├── android/             # Code natif Android
│   └── app/src/main/
│       └── AndroidManifest.xml
└── assets/              # Images et ressources
```

## Commandes (Makefile)

| Commande | Description |
|----------|-------------|
| `make run` | Lancer Expo en mode dev |
| `make compile_run` | Lancer Expo avec cache vidé |
| `make build_apk` | Construire l'APK (EAS) |
| `make build_eas` | Mettre à jour via EAS Update |

## Dependances principales

- `expo` : ~53.0.20
- `expo-notifications` : ^0.31.4
- `expo-device` : ^7.1.4
- `@reduxjs/toolkit` : ^2.8.2
- `redux-persist` : ^6.0.0
- `@react-native-async-storage/async-storage` : 2.1.2

## Notes techniques

### Calcul du temps restant

```typescript
const computeRemaining = (hh: number, mm: number, now: Date = new Date()) => {
    const wake = new Date(now);
    wake.setHours(hh, mm, 0, 0);
    if (wake <= now) wake.setDate(wake.getDate() + 1);
    const diffMin = Math.round((wake.getTime() - now.getTime()) / 60000);
    return { h: Math.floor(diffMin / 60), m: diffMin % 60, total: diffMin / 60 };
};
```

### Persistance

Les données sont sauvegardées via Redux Persist :
- `mode` : "semaine" | "weekend"
- `times` : { semaine: "HH:MM", weekend: "HH:MM" }
- `weekendEnabled` : boolean
