# proof.clavastack.com

## Projektübersicht

Eine **KI-gestützte Webanwendung zur Verifizierung von Manipulationsschutz-Beuteln** (Tamper-Evident Bags) für Specter Hardware Wallets. Die Anwendung nutzt Google Gemini AI für OCR (Texterkennung) um Seriennummern aus Fotos zu extrahieren.

**Live URL:** https://proof.clavastack.com/

---

## Architektur

```
┌─────────────────────────────────────────────────────────────┐
│              proof.clavastack.com (Frontend)                │
│              Hostinger Static Hosting                       │
│                     index.html                              │
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
              ┌──────────────┴──────────────┐
              ▼                             ▼
   ┌──────────────────────┐     ┌──────────────────────┐
   │   Google Gemini API  │     │  Google Cloud Storage │
   │    (2.5-flash)       │     │  (Bilder & Proofs)    │
   └──────────────────────┘     └──────────────────────┘
```

---

## Projektstruktur

```
proof.clavastack.com/
├── index.js              # Express Backend (Proxy zu Gemini API)
├── index.html            # Frontend (Vanilla JS + Tailwind CSS)
├── package.json          # Node.js Dependencies
├── Dockerfile            # Container-Konfiguration (Node 24 Alpine)
├── cloudbuild.yaml       # Google Cloud Build Pipeline
├── .github/
│   └── workflows/
│       └── test.yaml     # GitHub Actions CI/CD
├── README.md             # Kurze Projektbeschreibung
└── default.php.bak       # Hostinger Backup-Datei
```

---

## Technologie-Stack

| Komponente | Technologie |
|------------|-------------|
| **Backend Runtime** | Node.js 24 (Alpine) |
| **Web Framework** | Express.js 4.19.2 |
| **AI/OCR** | Google Gemini API (2.5-flash) |
| **SDK** | @google/genai 0.15.0 |
| **Frontend** | Vanilla JavaScript + Tailwind CSS |
| **Hosting Frontend** | Hostinger |
| **Hosting Backend** | Google Cloud Run |
| **CI/CD** | GitHub Actions + Cloud Build |
| **Container** | Docker |

---

## Backend (index.js)

### Endpoints

| Methode | Pfad | Auth | Beschreibung |
|---------|------|------|--------------|
| GET | `/` | Nein | Health Check |
| GET | `/api/proofs` | **Nein** | Alle Proofs offentlich abrufen |
| GET | `/api/proofs/:bagId` | **Nein** | Einzelnen Proof abrufen |
| POST | `/api/proofs` | Ja | Neuen Proof mit Bild erstellen (multipart/form-data) |
| PUT | `/api/proofs/:bagId` | Ja | Proof aktualisieren (z.B. Timestamp-Status) |
| DELETE | `/api/proofs/:bagId` | Ja | Proof loschen |
| POST | `/api/verify-serial-number` | Ja | Bild-Analyse via Gemini |

### Authentifizierung

- Header: `X-Auth-Token`
- Token wird in Cloud Run Environment Variable `AUTH_TOKEN` gespeichert
- Ohne gültigen Token: HTTP 401
- **GET /api/proofs ist offentlich** - keine Auth erforderlich

### Request Format (POST /api/proofs)

```
Content-Type: multipart/form-data

bagId: "12345"
version: "v1.9.0"
packer: "Schnuartz"
date: "2024-01-15T10:30:00Z"
hash: "sha256-hash"
otsData: "opentimestamps-hex"
status: "pending"
image: [Originale Bilddatei - wird 1:1 unverandert gespeichert]
```

### Response Format (GET /api/proofs)

```json
{
  "proofs": [
    {
      "bagId": "12345",
      "version": "v1.9.0",
      "packer": "Schnuartz",
      "date": "2024-01-15T10:30:00Z",
      "imageUrl": "https://storage.googleapis.com/bucket/images/12345_photo.jpg",
      "status": "verified",
      "blockHeight": "873421"
    }
  ],
  "lastUpdated": "2024-01-15T10:30:00Z"
}
```

### Environment Variables

| Variable | Beschreibung |
|----------|--------------|
| `GEMINI_API_KEY` | API-Schlussel fur Google Gemini |
| `AUTH_TOKEN` | Authentifizierungs-Token fur API-Zugriff |
| `GCS_BUCKET_NAME` | Name des Cloud Storage Buckets (Standard: clavastack-proofs) |
| `PORT` | Server-Port (Standard: 8080) |

---

## Frontend (index.html)

### Features

- Token-basierte Authentifizierung (gespeichert in localStorage)
- Bild-Upload mit Drag & Drop Support
- Echtzeit-Fortschrittsanzeige während der Analyse
- Ergebnis-Tabelle mit Status-Indikatoren
- Export als TSV (Tab-Separated Values)

### Backend URL

```
https://secure-ai-proxy-server-187831042201.europe-west1.run.app
```

---

## Deployment

### Automatisches Deployment via GitHub

Push auf `main` Branch deployt automatisch:
- **Frontend**: Hostinger (statische Dateien werden automatisch aktualisiert)
- **Backend**: Google Cloud Build triggert automatisch bei Push

```bash
git add .
git commit -m "feat: Your changes"
git push origin main
```

### Tailwind CSS Build

**WICHTIG**: Bei CSS-Änderungen vor dem Commit ausführen:

```bash
npm run build:css
```

### Docker Build (manuell)

```bash
docker build -t secure-ai-proxy-server .
```

### Cloud Run Deployment (manuell)

Automatisch via `cloudbuild.yaml`:

1. **Build**: Docker Image erstellen
2. **Push**: Image zu Google Container Registry
3. **Deploy**: Deployment auf Cloud Run (europe-west1)

```bash
gcloud builds submit --config cloudbuild.yaml
```

### Cloud Run Konfiguration

- **Region**: europe-west1
- **Machine Type**: N1_HIGHCPU_8
- **Port**: 8080
- **Unauthenticated Access**: Erlaubt (Auth über API-Token)

---

## Lokale Entwicklung

### Installation

```bash
npm install
```

### Tailwind CSS Watch Mode

```bash
npm run watch:css
```

### Server starten

```bash
# Environment Variables setzen
export GEMINI_API_KEY="your-api-key"
export AUTH_TOKEN="your-auth-token"

# Server starten
node index.js
```

Server läuft auf `http://localhost:8080`

### Frontend testen

`index.html` direkt im Browser öffnen oder mit VSCode Live Server (Port 5500).

---

## CI/CD Pipeline

### GitHub Actions (.github/workflows/test.yaml)

Triggert bei Push auf `main`/`master` oder Pull Requests:

1. Node.js 20 Setup
2. Dependencies installieren
3. Linting (falls konfiguriert)
4. Tests (falls konfiguriert)
5. HTML-Validierung
6. npm audit (Sicherheitsprüfung)

---

## Sicherheit

- **API-Schlüssel**: Nur in Cloud Run Environment, nie im Code
- **Token-Auth**: Alle API-Calls erfordern gültigen Token
- **CORS**: Eingeschränkt auf `proof.clavastack.com` und localhost
- **Payload-Limit**: 50MB für große Bilder

---

## Wichtige Hinweise

- **Sprache**: Gesamte UI und Prompts auf Deutsch
- **Datenspeicherung**: Google Cloud Storage fur Bilder und Metadaten (proofs.json)
- **Offentlicher Zugang**: GET /api/proofs ist ohne Auth zuganglich - alle Besucher sehen die Proofs
- **Bilder unverandert**: Bilder werden 1:1 mit Originalnamen in Cloud Storage gespeichert
- **Gemini Model**: `gemini-2.5-flash` fur schnelle Bildanalyse
- **Response Format**: JSON wird von Gemini erzwungen

---

## Google Cloud Storage Setup

### 1. Bucket erstellen

```bash
gsutil mb -p PROJECT_ID -l europe-west1 gs://clavastack-proofs
```

### 2. Bucket offentlich machen (fur Bild-URLs)

```bash
gsutil iam ch allUsers:objectViewer gs://clavastack-proofs
```

### 3. CORS konfigurieren

Erstelle `cors.json`:
```json
[
  {
    "origin": ["https://proof.clavastack.com", "http://localhost:5500"],
    "method": ["GET"],
    "responseHeader": ["Content-Type"],
    "maxAgeSeconds": 3600
  }
]
```

```bash
gsutil cors set cors.json gs://clavastack-proofs
```

### 4. Environment Variable in Cloud Run setzen

```bash
gcloud run services update secure-ai-proxy-server \
  --set-env-vars GCS_BUCKET_NAME=clavastack-proofs \
  --region europe-west1
```

---

## Troubleshooting

### Nach Deployment: Änderungen nicht sichtbar?

**Browser-Cache leeren!** Nach jedem Deployment:

```
Windows/Linux: Ctrl + Shift + R
Mac: Cmd + Shift + R
```

Oder in Chrome DevTools: Network Tab → "Disable cache" aktivieren.

### Bekannte Third-Party Fehler (ignorieren)

Diese Fehler in der Browser-Konsole sind **normal** und können nicht behoben werden:

1. **OpenTimestamps CORS-Fehler**: Einige Calendar-Server (`ots.btc.catallaxy.com`) blockieren Browser-Requests. Die Timestamps funktionieren trotzdem über andere Server.

2. **Browser-Extension Fehler** (`content_script.js`): Stammen von installierten Browser-Erweiterungen, nicht vom Projekt.
