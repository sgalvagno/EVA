# Compiler et installer EVA sur iOS

## Prerequis

- Un Mac, Node.js compatible Angular 18 (par exemple Node 22), npm et CocoaPods (`pod --version`). Si necessaire : `brew install cocoapods`.
- Xcode 15 minimum : EVA utilise Capacitor 6. Xcode 14.3.1 ne constitue pas une configuration prise en charge.
- Sous macOS Ventura : Xcode 15.2 necessite macOS 13.5 ou ulterieur. Xcode 15.4 necessite Sonoma 14.
- Pour iOS 26, privilegier un environnement officiellement adapte, tel que Xcode 26 sur macOS 15.6 minimum. La detection du telephone par un ancien Xcode ne garantit pas l'installation ni le debogage.
- Un compte Apple ajoute dans Xcode > Settings > Accounts. Une Personal Team permet les tests locaux avec des limites ; TestFlight necessite l'Apple Developer Program payant.

Si plusieurs Xcode sont installes, selectionner celui voulu dans Xcode > Settings > Locations > Command Line Tools. Verifier avec `xcodebuild -version` et `xcode-select -p`.

## Premier build

Depuis la racine du depot :

```sh
npm install
# Le depot utilise Capacitor 6.2.0 : ne pas installer la derniere majeure iOS.
npm install @capacitor/ios@6.2.0
npm run build
# Une seule fois, uniquement si le dossier ios n'existe pas encore :
npx cap add ios
npx cap sync ios
npx cap open ios
```

Le projet iOS n'est pas present dans le depot au moment de la redaction ; il peut deja exister dans une copie locale. Ne pas supprimer un dossier ios existant pour le regenerer sans sauvegarder ses reglages. L'installation de @capacitor/ios modifie package.json et peut creer ou modifier package-lock.json : conserver ces modifications si la prise en charge iOS doit etre partagee.

Avec CocoaPods, ouvrir `ios/App/App.xcworkspace`, pas seulement `App.xcodeproj`. Si la synchronisation echoue, verifier d'abord CocoaPods et la version Xcode selectionnee.

## Autorisations camera et phototheque

Dans `ios/App/App/Info.plist`, ajouter les descriptions requises par @capacitor/camera, a l'interieur du dictionnaire principal :

```xml
<key>NSCameraUsageDescription</key>
<string>EVA utilise la camera pour photographier votre echelle de douleur.</string>
<key>NSPhotoLibraryUsageDescription</key>
<string>EVA permet de choisir une photo de votre echelle de douleur.</string>
<key>NSPhotoLibraryAddUsageDescription</key>
<string>EVA peut enregistrer une photo dans votre phototheque.</string>
```

Adapter les descriptions aux fonctions effectivement proposees. Elles sont egalement editables dans la cible App > Info.

## Signature et lancement sur iPhone

1. Brancher et deverrouiller l'iPhone ; accepter de faire confiance au Mac.
2. Sur l'iPhone : Reglages > Confidentialite et securite > Mode developpeur. Activer, redemarrer, puis confirmer l'activation apres redemarrage.
3. Dans Xcode : projet App > TARGETS > App > Signing & Capabilities.
4. Activer Automatically manage signing et choisir la bonne Team.
5. Verifier le Bundle Identifier attendu : fr.sgalvagno.eva. Ne le changer que si necessaire ; un changement ne contourne pas le quota d'appareils.
6. Choisir l'iPhone comme destination, attendre sa preparation, puis lancer avec Cmd+R.

Un certificat present dans Manage Certificates ne garantit pas a lui seul que la signature est utilisable : sa validite, sa cle privee et le profil autorisant l'appareil sont aussi necessaires. Ne jamais committer de cle privee, fichier .p12, mot de passe ou jeton Apple.

## Builds suivants

Apres chaque changement du code web :

```sh
npm run build
npx cap sync ios
npx cap open ios
```

Puis relancer dans Xcode. Un simple build web ne met pas a jour l'application native deja installee.

## Depannage

### Developer Mode disabled

Activer le mode developpeur sur l'iPhone et confirmer apres redemarrage.

### Maximum number of registered iPhone devices / profile doesn't include device

Le quota de l'equipe empeche l'enregistrement du telephone ; le profil ne peut donc pas l'inclure. Verifier la Team avant de modifier les certificats.

- Personal Team gratuite : jusqu'a 3 appareils par plateforme ; les enregistrements et profils gratuits expirent apres 7 jours. Attendre qu'un emplacement se libere si le quota est atteint.
- Equipe payante : jusqu'a 100 appareils par famille et par annee d'adhesion. Desactiver un appareil ne restitue pas de place pendant cette annee.
- Equipe payante : consulter developer.apple.com/account > Certificates, Identifiers & Profiles > Devices, dans la bonne equipe.
- Window > Devices and Simulators montre les appareils connus de Xcode, pas necessairement tout le quota enregistre chez Apple.

Une fois l'appareil enregistrable, conserver la signature automatique et relancer pour actualiser le profil. Supprimer l'application ou changer le bundle ID ne libere pas un emplacement d'appareil.

### No profiles for fr.sgalvagno.eva were found

Verifier le compte, la Team, la signature automatique, le certificat et l'enregistrement de l'iPhone. Lire d'abord l'erreur precedente : un quota d'appareils peut expliquer l'absence de profil.

### OSStatus -2147416032 / failed to generate asymmetric keypair

Le premier code correspond a CSSMERR_CSP_OPERATION_AUTH_DENIED ; le second message indique un echec de generation de cles. Cela oriente vers l'acces aux services de securite/trousseau sans etablir une cause unique.

Quitter Xcode, ouvrir Trousseaux d'acces et verifier que le trousseau session/login est deverrouille. Son mot de passe est normalement celui de la session Mac, mais peut differer apres une reinitialisation de mot de passe. Rouvrir Xcode et verifier si un certificat a malgre tout ete cree. Ne pas supprimer tous les certificats, revoquer des certificats partages ni reinitialiser le trousseau a l'aveugle.

## Etat de validation

Ce guide documente la procedure et les erreurs rencontrees. La compilation complete, l'installation et le fonctionnement sur iPhone 16 sous iOS 26 ne sont pas confirmes.

## Sources

- https://capacitorjs.com/docs/v6/getting-started/environment-setup
- https://capacitorjs.com/docs/v6/ios
- https://capacitorjs.com/docs/v6/apis/camera
- https://developer.apple.com/documentation/xcode-release-notes/xcode-15_2-release-notes
- https://developer.apple.com/documentation/xcode-release-notes/xcode-15_4-release-notes
- https://developer.apple.com/documentation/xcode-release-notes/xcode-26-release-notes
- https://developer.apple.com/help/account/basics/about-your-developer-account/
- https://developer.apple.com/help/account/devices/devices-overview/
- https://developer.apple.com/documentation/xcode/enabling-developer-mode-on-a-device
- https://developer.apple.com/forums/thread/87208
- https://support.apple.com/guide/keychain-access/if-you-need-to-update-your-keychain-password-kyca2429/mac
