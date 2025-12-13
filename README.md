# proof.clavastack.com

**Blockchain-verified proof of packaging for Specter Hardware Wallets**

https://proof.clavastack.com/

## What it does

1. Upload or take a photo of Tamper-Evident Bags
2. AI (Google Gemini) extracts Bag IDs, firmware version, and packer info
3. Creates Bitcoin blockchain timestamp via OpenTimestamps
4. Stores proof in Google Cloud Storage

## Tech Stack

- **Frontend**: Vanilla JS + Tailwind CSS (Hostinger)
- **Backend**: Node.js/Express (Google Cloud Run)
- **AI**: Google Gemini 2.5 Flash
- **Storage**: Google Cloud Storage
- **Blockchain**: OpenTimestamps (Bitcoin)

## Pages

| Page | URL | Description |
|------|-----|-------------|
| Main | `/` | Public list of all proofs |
| Add | `/add/` | Create new proofs (auth required) |
| Admin | `/add/admin/` | Delete proofs (auth required) |

## Quick Start

```bash
# Install
npm install

# Build CSS
npm run build:css

# Run backend locally
export GEMINI_API_KEY="your-key"
export AUTH_TOKEN="your-token"
node index.js
```

## Deployment

Push to `main` branch auto-deploys:
- Frontend → Hostinger
- Backend → Google Cloud Run

## Documentation

See [CLAUDE.md](CLAUDE.md) for detailed documentation.
