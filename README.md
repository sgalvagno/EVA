# EVA

App Ionic/Angular (Capacitor) : photo d'une Echelle Visuelle Analogique, detection du trait patient, calcul en % et en cm (regle 10 cm).

## Installation

```bash
ionic start eva-app blank --type=angular --capacitor
npm i @capacitor/camera @ionic/pwa-elements
npx cap add android && npx cap add ios
```

Copier `src/app/eva.service.ts` et `src/app/home/home.page.*` dans le projet. Ajouter `FormsModule` au module de la page. Dans `main.ts` : `defineCustomElements(window)` (pwa-elements) pour le test navigateur.
