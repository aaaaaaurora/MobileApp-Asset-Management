# Asset Management – App Mobile (Android)

Ramo **`feature/mobile-app-conversion`** del progetto **Platform Asset Management** (tesi magistrale in Ingegneria Informatica, DIEM – Università degli Studi di Salerno, A.A. 2025/2026).

Questo repository contiene l'**app Android per gli Operatori sul campo**, ottenuta impacchettando la Web App React con **Capacitor**. Il backend a microservizi, i manifest Kubernetes e la pipeline sono gli stessi del ramo principale.

> 📘 **Architettura, microservizi, API, modello dati, deployment, CI/CD e accessi di produzione sono documentati nel README del progetto principale.** Qui sono descritte **solo le differenze** dell'app mobile.

**Autrici:** Aurora Campione, Claudia Carucci

---

## Indice

1. [A cosa serve l'app](#1-a-cosa-serve-lapp)
2. [Cosa cambia rispetto al ramo principale](#2-cosa-cambia-rispetto-al-ramo-principale)
3. [Struttura del progetto Android](#3-struttura-del-progetto-android)
4. [Funzionalità native](#4-funzionalità-native)
5. [Login sull'app e restrizione agli Operatori](#5-login-sullapp-e-restrizione-agli-operatori)
6. [Modifiche al backend](#6-modifiche-al-backend)
7. [Installazione dell'APK](#7-installazione-dellapk)
8. [Utilizzo e test](#8-utilizzo-e-test)
9. [Compilare l'app dal sorgente](#9-compilare-lapp-dal-sorgente)
10. [Limitazioni note e punti da rivedere](#10-limitazioni-note-e-punti-da-rivedere)

---

## 1. A cosa serve l'app

L'app mobile è lo strumento di lavoro dell'**Operatore** e copre le attività che richiedono i sensori dello smartphone:

- **censimento di nuovi asset** con posizione GPS e foto scattate in loco;
- **suggerimento automatico dei metadati** dalle foto (Google Cloud Vision, tramite Media Service) con revisione manuale;
- consultazione e aggiornamento degli asset del proprio campus;
- gestione delle segnalazioni pubbliche e registrazione degli interventi.

Amministratori e Utenti Base usano invece la **Web App**. Il censimento di nuovi asset è disponibile **solo da app mobile**, come previsto dal vincolo `VN-ARC-04` dell'SRS.

---

## 2. Cosa cambia rispetto al ramo principale

Il ramo mobile è identico al principale per backend, `k8s/` e `Jenkinsfile`. Le differenze riguardano il frontend e l'aggiunta del progetto Android.

| Area | Ramo principale (Web) | Ramo mobile |
|---|---|---|
| **Contenitore** | Build servita da Nginx | Build Vite impacchettata in una WebView Android tramite **Capacitor** (`webDir: dist`) |
| **Progetto nativo** | – | Nuova cartella `frontend/android/` (Gradle, manifest, `MainActivity`) e `frontend/capacitor.config.ts` |
| **Router** | `BrowserRouter` | **`HashRouter`**: la WebView carica file locali, senza server che gestisca gli URL |
| **Base path Vite** | `base: "/"` | `base: "./"` (percorsi relativi per gli asset locali) |
| **Pagina iniziale** | – | La rotta `/` reindirizza a `/signin` |
| **Login Google** | Popup web (`@react-oauth/google`, `access_token`) | Plugin nativo `@codetrix-studio/capacitor-google-auth` (`id_token`); la Web App mantiene il flusso web |
| **Accesso per ruolo** | Tutti i ruoli | Sull'app nativa entra **solo l'Operatore** |
| **Menu Operatore** | Segnalazioni, Lista Assets | In più la voce **"Nuovo Asset"**, visibile solo su piattaforma nativa (`Capacitor.isNativePlatform()`) |
| **Chiamate di rete** | `fetch` del browser | `CapacitorHttp` abilitato (chiamate native, non soggette ai limiti della WebView) |
| **Build** | Un unico bundle | `manualChunks` separa `maplibre`/`react-map-gl` e `@capacitor` in chunk dedicati, per ridurre il consumo di RAM sul dispositivo |
| **Debug** | – | **vConsole** attivo in `main.tsx` per diagnosticare la WebView |
| **CORS del gateway** | `CORS(app)` aperto | Origini esplicite: Web App (`http://192.168.72.109.nip.io:32080`) e Android (`http://localhost`) |

Il ramo contiene anche alcune modifiche alla Web App non legate al mobile: pagina categorie con `CategoryManagerModal` al posto di `CategoryManager`, e in dashboard i componenti `DynamicAttributeChart` e `RecentLogsTable`. Le altre differenze sono solo di formattazione.

Il codice della pagina di censimento (`CreateAsset.tsx`) è **lo stesso della Web App**: la parte GPS, fotocamera e galleria funziona in entrambi i contesti e sfrutta i plugin nativi quando eseguita sull'app.

---

## 3. Struttura del progetto Android

```
frontend/
├── capacitor.config.ts                 # appId, appName, plugin, cleartext
├── vite.config.ts                      # base "./" e manualChunks
├── src/
│   ├── App.tsx                         # HashRouter e redirect iniziale
│   ├── main.tsx                        # inizializza vConsole
│   ├── components/auth/SignInForm.tsx  # login nativo + blocco ruoli
│   ├── layout/AppSidebar.tsx           # menu "Nuovo Asset" solo su nativo
│   └── pages/AssetPages/CreateAsset.tsx # censimento con GPS e foto
└── android/
    ├── app/
    │   ├── build.gradle                # applicationId com.unisa.asset
    │   └── src/main/
    │       ├── AndroidManifest.xml     # permessi, cleartext, FileProvider
    │       └── java/com/unisa/asset/MainActivity.java   # BridgeActivity
    ├── build.gradle  variables.gradle  gradlew  gradle/wrapper/
    └── app-release/
        └── app-debug.apk               # APK installabile (~17 MB)
```

**Parametri dell'app**

| | |
|---|---|
| Nome | Asset Management |
| Package (`appId`) | `com.unisa.asset` |
| Versione | `1.0` (`versionCode 1`) |
| Android minimo | API 24 (Android 7.0) |
| `compileSdk` / `targetSdk` | 36 |
| Android Gradle Plugin / Gradle | 8.13.0 / 8.14.3 |
| Capacitor | 8.x (`core`, `android`, `cli`) |

**Plugin nativi**

| Plugin | Uso |
|---|---|
| `@capacitor/camera` | Scatto foto e selezione dalla galleria (con richiesta dei permessi) |
| `@capacitor/geolocation` | Posizione GPS |
| `@codetrix-studio/capacitor-google-auth` | Login Google nativo |

---

## 4. Funzionalità native

- **Fotocamera e galleria:** la pagina di censimento controlla e richiede i permessi (`Camera.checkPermissions` / `requestPermissions`), scatta con `Camera.getPhoto` (sorgente fotocamera) o seleziona più immagini con `Camera.pickImages`. Se il permesso è negato mostra un messaggio che invita ad abilitarlo dalle impostazioni.
- **GPS:** all'avvio del censimento le coordinate vengono acquisite con `navigator.geolocation` (il plugin `@capacitor/geolocation` è installato ma il codice usa l'API della WebView). La posizione viene poi verificata dal GeoZone Service (`/geozone/api/geozones/verify-location`) rispetto ai campus dell'Operatore: l'asset è associato al campus in cui ricade. Senza permesso o segnale l'inserimento è bloccato con un messaggio di errore.
- **Foto obbligatoria:** il censimento richiede almeno una foto; le immagini vengono poi compresse dal Media Service e analizzate con Cloud Vision per precompilare i campi.

**Permessi dichiarati in `AndroidManifest.xml`**

| Permesso | Motivo |
|---|---|
| `INTERNET` | Comunicazione con il backend |
| `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION` | Georeferenziazione degli asset |
| `CAMERA` | Foto degli asset |
| `READ_EXTERNAL_STORAGE`, `READ_MEDIA_IMAGES` | Selezione dalla galleria |
| `ACCESS_BACKGROUND_LOCATION` | Dichiarato ma non necessario (vedi [sezione 10](#10-limitazioni-note-e-punti-da-rivedere)) |

L'app usa inoltre `usesCleartextTraffic="true"` e `server.cleartext: true` in Capacitor, perché il backend di dipartimento è raggiunto in **HTTP** su rete interna/VPN.

---

## 5. Login sull'app e restrizione agli Operatori

Il flusso in `SignInForm.tsx` si biforca in base alla piattaforma:

```
Clic su "Accedi con Google"
        │
        ├─ Piattaforma nativa (APK) ─► GoogleAuth.signIn() ─► id_token ─┐
        │                                                                ├─► POST /api/auth/auth/google
        └─ Browser (Web App) ───────► useGoogleLogin()   ─► access_token ┘         │
                                                                                   ▼
                                                            2FA (codice Microsoft Authenticator)
                                                                                   │
                                                          ruolo ≠ OPERATORE su app nativa? ─► "Accesso negato"
                                                                                   │
                                                                                   ▼
                                                                          Accesso all'app
```

- Al termine della 2FA, se il JWT non ha il ruolo `OPERATORE` l'app mostra: *«Accesso negato: L'app mobile è riservata esclusivamente agli Operatori sul campo.»*
- Il controllo è **lato client** (Amministratori e Guest sono comunque indirizzati alla Web App). L'autorizzazione vera resta sul backend tramite JWT e RBAC.
- Per accedere serve un profilo Operatore creato dall'Amministratore dalla dashboard web (`/admin/operators`), con campus e categoria assegnati.

---

## 6. Modifiche al backend

Nel ramo mobile cambia un solo file di backend rilevante:

- **API Gateway (`api-gateway-service/app.py`):** il CORS non è più aperto a tutte le origini, ma limitato a Web App e origine locale di Capacitor, con `supports_credentials`.

Il `verify_google_token` dell'Auth Service (uguale nei due rami) gestisce già entrambi i flussi: se il token ha tre segmenti separati da punti è un **`id_token`** (app mobile) e viene verificato con `google-auth`; altrimenti è un **`access_token`** (Web App) e viene validato tramite l'endpoint `userinfo` di Google.

L'URL dell'API usato dall'app è in `frontend/.env`: `VITE_API_URL=http://192.168.72.109.nip.io:32050/api` (API Gateway sul NodePort `32050`).

---

## 7. Installazione dell'APK

> 🔐 Prerequisiti: **OpenVPN attiva** (o rete di campus), smartphone **Android 7.0+** con GPS e fotocamera, app **Microsoft Authenticator** installata.

L'APK è in:

```
frontend/android/app-release/app-debug.apk
```

```bash
git clone https://github.com/aaaaaaurora/MobileApp-Asset-Management.git
cd MobileApp-Asset-Management
git checkout feature/mobile-app-conversion

# Installazione via ADB (debug USB attivo)
adb install frontend/android/app-release/app-debug.apk
```

In alternativa, copia il file sullo smartphone, aprilo e abilita l'installazione da **origini sconosciute**.

---

## 8. Utilizzo e test

1. **Crea un Operatore** dalla dashboard web (`http://192.168.72.109.nip.io:32080/signin`, accesso Amministratore – credenziali nel README principale): e-mail Google, campus e categoria di asset.
2. **Apri l'app** e accedi con l'account Google di quell'e-mail.
3. **Configura la 2FA** (al primo accesso l'app mostra il QR/chiave da inserire in Microsoft Authenticator) e inserisci il codice.
4. Verifica il flusso principale:

| # | Azione | Esito atteso |
|---|---|---|
| 1 | Login con account non Operatore | Messaggio di accesso negato |
| 2 | Menu laterale | Compaiono **Nuovo Asset**, Segnalazioni e Lista Assets |
| 3 | Nuovo Asset → scegli categoria | GPS acquisito automaticamente |
| 4 | Scatta o scegli una foto | Anteprima; permessi richiesti al primo uso |
| 5 | Analisi AI | Campi precompilati; form vuoto se il servizio AI non risponde |
| 6 | Correggi e salva | Asset visibile in mappa e in elenco |
| 7 | Segnalazioni | Elenco limitato ai campus assegnati; chiusura con nota |
| 8 | Nega permessi GPS/fotocamera | Messaggio di errore guidato |

---

## 9. Compilare l'app dal sorgente

La pipeline Jenkins costruisce solo la Web App: l'**APK non è generato dalla CI** e va compilato in locale.

**Prerequisiti:** Node.js 18+, JDK compatibile con Android Gradle Plugin 8.13 (17 o superiore, verifica la versione richiesta da Capacitor 8), Android SDK con piattaforma 36 (ad esempio tramite Android Studio).

```bash
cd frontend
npm install --legacy-peer-deps
# controlla in .env: VITE_GOOGLE_CLIENT_ID e VITE_API_URL

npm run build                 # genera dist/
npx cap sync android          # copia dist/ e i plugin nel progetto Android

cd android
./gradlew assembleDebug
# APK: frontend/android/app/build/outputs/apk/debug/app-debug.apk
```

In alternativa apri `frontend/android` con Android Studio (`npx cap open android`) ed esegui **Run** su dispositivo o emulatore.

Ogni modifica al codice React richiede di ripetere `npm run build` e `npx cap sync android`.

---

## 10. Limitazioni note e punti da rivedere

- **Build debug:** l'APK è firmato con la chiave di debug ed è pensato solo per la dimostrazione. Per la distribuzione serve una build **release** firmata.
- **vConsole sempre attiva:** in `main.tsx` la console di debug è inizializzata in ogni build, con un commento che la indica come temporanea; va rimossa (o attivata solo in sviluppo) prima di un rilascio.
- **Traffico HTTP in chiaro:** il backend è raggiunto senza TLS (`usesCleartextTraffic`, `cleartext: true`). Va bene sulla VPN di dipartimento, non in produzione pubblica, dove servirebbero HTTPS e certificati.
- **`ACCESS_BACKGROUND_LOCATION`:** è dichiarato nel manifest ma l'app acquisisce la posizione solo in primo piano; conviene toglierlo (è un permesso sensibile per gli store).
- **Restrizione dei ruoli solo lato client:** il blocco degli utenti non Operatori è fatto nell'interfaccia; la sicurezza reale resta su JWT e RBAC del backend.
- **Client ID Android:** in `verify_google_token` la lista delle audience accetta un segnaposto (`INSERISCI_QUI_IL_TUO_CLIENT_ID_ANDROID`); per un ambiente reale va sostituito con il Client ID Android effettivo.
- **URL dell'API fisso:** `VITE_API_URL` è incorporato in fase di build; cambiare server richiede di ricompilare l'app.
- **Segreti nel repository:** come nel ramo principale, `frontend/.env` e `auth-service/client_secret.json` sono versionati per l'ambiente dimostrativo; ruotarli e non versionarli in caso di uso reale.
- **Solo Android:** la dipendenza `@capacitor/ios` è presente, ma il progetto iOS non è stato generato.

---

## Licenza e contatti

Progetto accademico – DIEM, Università degli Studi di Salerno. La base grafica dell'interfaccia è *TailAdmin React* (licenza MIT, `frontend/LICENSE.md`).

| | |
|---|---|
| **Aurora Campione** | a.campione5@studenti.unisa.it |
| **Claudia Carucci** | – |
