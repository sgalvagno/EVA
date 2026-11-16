# EVA

Prototype Ionic Angular / Capacitor : photo d'une echelle EVA horizontale, detection du trait patient et conversion sur une echelle de 10 cm.

## Developpement

Node 22 :

```bash
npm install
npm start
```

## Android

Java 17 et Android SDK sont necessaires en local.

```bash
npm run build
npx cap add android
npx cap sync android
cd android
bash ./gradlew assembleDebug
```

Executer `cap add` seulement a la premiere creation du dossier Android.

## GitHub Actions

Le workflow installe les dependances avec npm install, compile le web, genere le projet Android si absent et publie l'APK debug sous eva-debug-apk.

Aucun package-lock.json n'a ete genere localement pour ce commit. Le workflow publie celui genere par npm dans l'artefact npm-lockfile. Le recuperer et le committer permettra ensuite de remplacer npm install par npm ci et d'activer le cache npm. En attendant, les dependances transitives ne sont pas verrouillees.

Les versions sont epinglees sur une base Angular 18 / Capacitor 6 ; une mise a niveau et un audit seront necessaires avant production. Le build CI et les essais sur appareil restent a verifier.

## Limites

Prototype non valide pour un usage clinique. Detection prevue pour une regle horizontale et une photo de face. Le code initial utilise une position par defaut si la detection echoue : elle ne doit pas etre consideree comme une mesure. Verification manuelle indispensable. Aucune precision metrologique garantie.
