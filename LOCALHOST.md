# Local Development Setup

This guide explains how to run **proof.clavastack.com** on your local machine.

## Quick Start

### 1. Terminal 1 - Start the Backend Server

```bash
node index-local.js
```

Expected output:
```
✓ Local Server running on port 8080
📝 Demo Token: "demo-token"
📝 Demo Packer: "Schnuartz"
```

### 2. Terminal 2 - Start the Frontend Server

Option A (Using npm):
```bash
npx serve -p 3000
```

Option B (Using VSCode Live Server):
1. Open `index.html` in VSCode
2. Right-click → "Open with Live Server" (port 5500)

Option C (Using Python):
```bash
python -m http.server 3000
```

Then open your browser:
- **Frontend**: http://localhost:3000 or http://localhost:5500
- **Backend API**: http://localhost:8080

---

## Features Available Locally

### ✓ Working Features
- View all proofs (GET `/api/proofs`)
- Add new proofs (POST `/api/proofs`) - requires auth token
- Upload images
- Camera functionality (requires HTTPS or localhost)
- Edit/delete proofs (admin panel)
- Timestamps verification (OpenTimestamps integration)

### ⚠️ Requires Configuration
- **Gemini AI Image Analysis** - needs `GEMINI_API_KEY` environment variable
- To enable: `export GEMINI_API_KEY="your-actual-api-key"`

---

## Authentication

### Demo Credentials

**Token**: `demo-token`
**Packer**: `Schnuartz`

The demo token is pre-configured. To test authentication:

1. Open browser DevTools (F12)
2. Go to Application → Local Storage
3. Create entry: `authToken = demo-token`
4. Reload page

Or paste this in the console:
```javascript
localStorage.setItem('authToken', 'demo-token');
location.reload();
```

---

## API Endpoints (Local)

All endpoints are available at `http://localhost:8080`

### Public Endpoints (No Auth Required)
- `GET /api/proofs` - List all proofs
- `GET /api/proofs/:bagId` - Get specific proof

### Protected Endpoints (Requires X-Auth-Token Header)
- `POST /api/proofs` - Create new proof with image upload
- `PUT /api/proofs/:bagId` - Update proof
- `DELETE /api/proofs/:bagId` - Delete proof
- `POST /api/verify-serial-number` - Analyze image with Gemini AI

---

## File Structure

```
local_storage/
├── data/
│   └── proofs.json        # All proof metadata
└── images/
    └── {bagId}_*.{jpg,png}  # Uploaded images
```

---

## Using Gemini AI Image Analysis

### Setup
1. Get your API key from [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Set environment variable before starting the server:

```bash
# macOS/Linux
export GEMINI_API_KEY="your-api-key-here"
node index-local.js

# Windows (PowerShell)
$env:GEMINI_API_KEY="your-api-key-here"
node index-local.js

# Windows (CMD)
set GEMINI_API_KEY=your-api-key-here
node index-local.js
```

3. Now the `/api/verify-serial-number` endpoint will work
4. Upload images in the add page - they'll be analyzed by Gemini

---

## Customizing Configuration

### Change Backend Port
```bash
PORT=9000 node index-local.js
```

### Change Storage Location
```bash
STORAGE_PATH="./my_storage" node index-local.js
```

### Add Custom Auth Token
```bash
AUTH_TOKENS='{"mytoken":"MyPacker"}' node index-local.js
```

---

## Troubleshooting

### "Connection refused" on port 8080
- Make sure the backend server is running in Terminal 1
- Check if another app is using port 8080: `lsof -i :8080` (macOS/Linux) or `netstat -ano | findstr :8080` (Windows)

### Camera not working
- Ensure you're using HTTPS or localhost
- Check browser permissions (Settings → Privacy → Camera)
- On mobile: open in actual browser, not in-app browser

### Images not appearing after upload
- Check `local_storage/images/` folder
- Verify backend console shows upload success
- Clear browser cache (Ctrl+Shift+R or Cmd+Shift+R)

### Gemini API returns errors
- Verify API key is set: check backend console on startup
- Check quota/billing on Google Cloud Console
- Review error message in network tab (DevTools → Network)

### localStorage quota exceeded
- Clear browser cache and local storage (DevTools → Application → Storage → Clear site data)
- Images are automatically removed before saving to avoid this

---

## Development Tips

### Watch for Changes
1. Backend: You'll need to restart `node index-local.js` for code changes
2. Frontend: Live Server auto-reloads on file changes

### Debug Mode
- Open browser DevTools (F12)
- Check Console for errors
- Check Network tab for API requests

### Test with curl
```bash
# Get all proofs
curl http://localhost:8080/api/proofs

# Get specific proof
curl http://localhost:8080/api/proofs/DEMO-001

# Create proof (requires auth token)
curl -X POST http://localhost:8080/api/proofs \
  -H "X-Auth-Token: demo-token" \
  -H "Content-Type: application/json" \
  -d '{"bagId":"TEST-001","version":"v1.9.0","packer":"Schnuartz"}'
```

---

## Resetting Local Data

Delete the entire `local_storage` folder to reset:
```bash
rm -rf local_storage
node index-local.js
```

The directory and initial `proofs.json` will be recreated.

---

## Next Steps

1. ✅ Backend running on port 8080
2. ✅ Frontend running on port 3000 or 5500
3. ✅ Demo account configured
4. 🔧 (Optional) Set up Gemini API key for image analysis
5. 🚀 Start creating proofs!
