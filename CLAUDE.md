# proof.clavastack.com

## Projektübersicht

Eine **KI-gestützte Webanwendung zur Verifizierung von Manipulationsschutz-Beuteln** (Tamper-Evident Bags) für Specter Hardware Wallets. Die Anwendung nutzt Google Gemini AI für OCR (Texterkennung) um Seriennummern aus Fotos zu extrahieren und erstellt **Bitcoin Blockchain Timestamps** via OpenTimestamps.

**Live URL:** https://proof.clavastack.com/

---

## Architektur

```
┌─────────────────────────────────────────────────────────────┐
│              proof.clavastack.com (Frontend)                │
│              Hostinger Static Hosting                       │
│         index.html, /add/index.html, /add/admin/            │
└────────────────────────────┬────────────────────────────────┘
                             │
                    HTTP GET/POST + X-Auth-Token
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│              Google Cloud Run (europe-west1)                │
│           secure-ai-proxy-server (Node.js/Express)          │
│                        index.js                             │
└────────────────────────────┬────────────────────────────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
   ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
   │ Google Gemini AI │ │ Cloud Storage    │ │ OpenTimestamps   │
   │ (gemini-2.5-flash)│ │ (Bilder/Proofs) │ │ (Bitcoin Blockchain)│
   └──────────────────┘ └──────────────────┘ └──────────────────┘
```

---

## Projektstruktur

```
proof.clavastack.com/
├── index.html              # Hauptseite - Liste aller Proofs (öffentlich)
├── index.js                # Express Backend (Cloud Run)
├── add/
│   ├── index.html          # Neue Proofs erstellen (Auth erforderlich)
│   └── admin/
│       └── index.html      # Admin Panel - Proofs löschen
├── assets/
│   ├── logos/              # Supplier & Partner Logos
│   ├── flags/              # Sprachflaggen (en.svg, de.svg)
│   └── favicon.svg
├── dist/
│   └── output.css          # Kompiliertes Tailwind CSS
├── src/
│   └── input.css           # Tailwind Source CSS
├── package.json            # Node.js Dependencies
├── tailwind.config.js      # Tailwind Konfiguration
├── Dockerfile              # Container (Node 24 Alpine)
├── cloudbuild.yaml         # Google Cloud Build Pipeline
└── .github/workflows/
    └── test.yaml           # GitHub Actions CI/CD
```

---

## Seiten & Features

### 1. Hauptseite (`/index.html`)
- **Öffentlich zugänglich** - keine Authentifizierung
- Zeigt alle verifizierten Proofs in einer Tabelle
- Suchfunktion (Bag ID, Datum, Version, Packer, Block)
- Sortierung (Datum, Bag ID)
- CSV Export
- Klick auf Proof öffnet Details-Modal mit:
  - SHA-256 Hash
  - Bitcoin Block Höhe & Zeit (wenn verifiziert)
  - Download .ots Datei
  - Link zu OpenTimestamps.org für externe Verifikation
- Supplier-Übersicht mit Links

### 2. Add Page (`/add/index.html`)
- **Authentifizierung erforderlich** (Token in localStorage)
- Zwei Optionen für Bildquelle:
  - **Datei-Upload**: Drag & Drop oder Datei auswählen
  - **Kamera**: Live-Vorschau, Foto aufnehmen (Desktop & Mobile)
- Workflow:
  1. Bild hochladen/aufnehmen
  2. Gemini AI analysiert Bild → extrahiert Bag IDs, Version, Packer
  3. OpenTimestamps erstellt Bitcoin Blockchain Proof
  4. Proof wird in Cloud Storage gespeichert
- Ergebnistabelle mit Status (Pending/Verified)

### 3. Admin Panel (`/add/admin/index.html`)
- **Authentifizierung erforderlich**
- Liste aller Proofs mit Checkboxen
- Mehrfachauswahl und Löschen
- Löscht Proof-Daten UND Bilder aus Cloud Storage

---

## OpenTimestamps Integration

### Wie es funktioniert

1. **Hash-Berechnung**: SHA-256 Hash wird vom **Original-Bild** berechnet (nicht von Metadaten!)
2. **Timestamp erstellen**: Hash wird an OpenTimestamps Calendar-Server gesendet
3. **Bitcoin Blockchain**: Calendar-Server bündeln Hashes und verankern in Bitcoin Transaction
4. **Verifikation**: Nach einigen Stunden ist der Timestamp in der Blockchain verifiziert

### Wichtig für Verifikation

Die `.ots` Datei enthält den Hash des **Original-Bildes**. Um auf OpenTimestamps.org zu verifizieren:
1. Bild von der Webseite herunterladen
2. `.ots` Datei herunterladen
3. Beide auf https://opentimestamps.org hochladen
4. Hash stimmt überein → Verifikation erfolgreich

**Code-Referenz**: `add/index.html:616-644` - `createTimestamp()` Funktion

---

## Backend API (index.js)

### Endpoints

| Methode | Pfad | Auth | Beschreibung |
|---------|------|------|--------------|
| GET | `/` | Nein | Health Check |
| GET | `/api/proofs` | **Nein** | Alle Proofs öffentlich abrufen |
| GET | `/api/proofs/:bagId` | **Nein** | Einzelnen Proof abrufen |
| POST | `/api/proofs` | Ja | Neuen Proof erstellen (multipart/form-data) |
| PUT | `/api/proofs/:bagId` | Ja | Proof aktualisieren |
| DELETE | `/api/proofs/:bagId` | Ja | Proof löschen (inkl. Bild) |
| POST | `/api/verify-serial-number` | Ja | Bild-Analyse via Gemini AI |

### Authentifizierung

- Header: `X-Auth-Token`
- Tokens in Cloud Run Environment Variable: `AUTH_TOKENS` (JSON-Format)
- Format: `{"token1":"Packer1","token2":"Packer2"}`
- Jeder Token ist einem Versiegler (Packer) zugeordnet
- GET Endpoints sind öffentlich, POST/PUT/DELETE erfordern Token
- Bei neuen Proofs wird das Feld `sealedBy` automatisch vom Token-Packer gesetzt

### Datenspeicherung (Cloud Storage)

```
gs://clavastack-proofs/
├── data/
│   └── proofs.json         # Alle Proof-Metadaten
└── images/
    └── {bagId}_{filename}  # Original-Bilder (unverändert)
```

### Environment Variables

| Variable | Beschreibung |
|----------|--------------|
| `GEMINI_API_KEY` | Google Gemini API Key |
| `AUTH_TOKENS` | JSON mit Token-Packer-Zuordnung, z.B. `{"token":"Schnuartz"}` |
| `GCS_BUCKET_NAME` | Cloud Storage Bucket (default: clavastack-proofs) |
| `PORT` | Server-Port (default: 8080) |

---

## Kamera-Funktion

### Features
- Funktioniert auf Desktop (Webcam) und Mobile (Handy-Kamera)
- "Switch Camera" Button zum Wechseln zwischen Front-/Rückkamera
- Live Video-Preview
- Aufnahme speichert JPEG mit Timestamp im Dateinamen
- Aufgenommenes Foto wird wie hochgeladene Datei behandelt

### Technische Details
- Verwendet `navigator.mediaDevices.getUserMedia()`
- `facingMode: 'environment'` für Rückkamera (default)
- `facingMode: 'user'` für Frontkamera
- Canvas für Foto-Capture, Export als JPEG (90% Qualität)

**Code-Referenz**: `add/index.html:576-733` - Camera Functions

---

## Internationalisierung (i18n)

### Unterstützte Sprachen
- **Englisch (en)** - Default
- **Deutsch (de)**

### Implementierung
- Sprachauswahl im Header (Flaggen-Dropdown)
- Sprache wird in `localStorage` gespeichert
- Alle Texte über `translations` Objekt
- HTML-Elemente mit `data-i18n` Attribut werden automatisch übersetzt

---

## Deployment

### Automatisches Deployment

Push auf `main` Branch:
- **Frontend**: Hostinger aktualisiert automatisch
- **Backend**: Cloud Build triggert automatisch

```bash
git add .
git commit -m "feat: Beschreibung"
git push origin main
```

### Tailwind CSS

Bei CSS-Änderungen vor Commit:
```bash
npm run build:css
```

Entwicklung mit Watch-Mode:
```bash
npm run watch:css
```

### Manuelles Cloud Run Deployment

```bash
gcloud builds submit --config cloudbuild.yaml
```

---

## Lokale Entwicklung

### Installation
```bash
npm install
```

### Backend starten
```bash
export GEMINI_API_KEY="your-key"
export AUTH_TOKEN="your-token"
node index.js
```

### Frontend testen
- `index.html` im Browser öffnen
- Oder VSCode Live Server (Port 5500)
- Für HTTPS (Kamera): `npx serve` oder ähnlich

---

## Troubleshooting

### Browser-Cache
Nach Deployment immer Cache leeren:
- Windows/Linux: `Ctrl + Shift + R`
- Mac: `Cmd + Shift + R`

### OpenTimestamps "File does not match"
- Stelle sicher, dass das **exakt gleiche Bild** verwendet wird
- Keine Komprimierung/Konvertierung beim Download
- Hash wird vom Bild berechnet, nicht von Metadaten

### Kamera funktioniert nicht
- HTTPS erforderlich (außer localhost)
- Browser-Berechtigung für Kamera prüfen
- Auf Mobile: Seite in echtem Browser öffnen (nicht In-App Browser)

### Bekannte Third-Party Fehler (ignorieren)
1. **OpenTimestamps CORS-Fehler**: Einige Calendar-Server blockieren Browser-Requests
2. **Browser-Extension Fehler**: Stammen von installierten Erweiterungen

---

## Sicherheit

- **API-Keys**: Nur in Cloud Run Environment, nie im Code
- **Token-Auth**: Schreibende API-Calls erfordern Token
- **CORS**: Eingeschränkt auf proof.clavastack.com und localhost
- **Bilder**: Original-Bilder werden unverändert gespeichert (wichtig für Hash-Verifikation)
