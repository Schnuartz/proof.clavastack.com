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
                    HTTP POST + X-Auth-Token
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│              Google Cloud Run (europe-west1)                │
│           secure-ai-proxy-server (Node.js/Express)          │
│                        index.js                             │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
                  ┌──────────────────────┐
                  │   Google Gemini API  │
                  │    (2.5-flash)       │
                  └──────────────────────┘
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
| POST | `/api/verify-serial-number` | Ja | Bild-Analyse via Gemini |

### Authentifizierung

- Header: `X-Auth-Token`
- Token wird in Cloud Run Environment Variable `AUTH_TOKEN` gespeichert
- Ohne gültigen Token: HTTP 401

### Request Format (POST /api/verify-serial-number)

```json
{
  "data": "base64-encoded-image-data",
  "mimeType": "image/jpeg"
}
```

### Response Format

```json
[
  { "bagId": "12345", "serialNumber": "ABC-123-XYZ" },
  { "bagId": "67890", "serialNumber": "DEF-456-UVW" }
]
```

### Environment Variables

| Variable | Beschreibung |
|----------|--------------|
| `GEMINI_API_KEY` | API-Schlüssel für Google Gemini |
| `AUTH_TOKEN` | Authentifizierungs-Token für API-Zugriff |
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
https://backend-proof-clavastack-com-205299921692.europe-west1.run.app
```

---

## Deployment

### Docker Build

```bash
docker build -t secure-ai-proxy-server .
```

### Cloud Run Deployment

Automatisch via `cloudbuild.yaml`:

1. **Build**: Docker Image erstellen
2. **Push**: Image zu Google Container Registry
3. **Deploy**: Deployment auf Cloud Run (europe-west1)

### Manuelles Deployment

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

`index.html` direkt im Browser öffnen oder mit Live Server.

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
- **CORS**: Aktuell `*` (für Produktion einschränken)
- **Payload-Limit**: 50MB für große Bilder

---

## Wichtige Hinweise

- **Sprache**: Gesamte UI und Prompts auf Deutsch
- **Stateless**: Keine Datenbank, jede Anfrage ist unabhängig
- **Gemini Model**: `gemini-2.5-flash` für schnelle Bildanalyse
- **Response Format**: JSON wird von Gemini erzwungen
