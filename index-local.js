console.log("Starting up locally ...");

// --- Umgebungsvariablen laden und prüfen ---
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "demo-key-for-testing";
const AUTH_TOKENS = process.env.AUTH_TOKENS ? JSON.parse(process.env.AUTH_TOKENS) : { "demo-token": "Schnuartz" };
const PORT = process.env.PORT || 8080;
const STORAGE_PATH = process.env.STORAGE_PATH || './local_storage';

// Prüfen Sie, ob die kritischen Variablen vorhanden sind.
if (!GEMINI_API_KEY) {
    console.warn("WARNING: GEMINI_API_KEY not set. Image analysis will not work. Set: GEMINI_API_KEY=your-key");
}

// --- Importe ---
import express from 'express';
import { GoogleGenAI } from '@google/genai';
import cors from 'cors';
import multer from 'multer';
import OpenTimestamps from 'opentimestamps';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname for local file operations
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Initialisierung ---
const app = express();
console.log("Setting up Gemini AI ...");
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

// Multer für Datei-Uploads (im Speicher halten für unveränderten Upload)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB Limit
});

// --- Middleware ---
console.log("Configuring middleware ...");
const allowedOrigins = [
    'https://proof.clavastack.com',
    'https://www.proof.clavastack.com',
    'http://localhost:3000',
    'http://localhost:8080',
    'http://127.0.0.1:5500',
    'http://localhost:5500'
];

app.use(cors({
    origin: function(origin, callback) {
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            console.warn(`CORS blocked request from origin: ${origin}`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['GET', 'POST', 'OPTIONS', 'DELETE', 'PUT'],
    allowedHeaders: ['Content-Type', 'X-Auth-Token'],
    credentials: false
}));

app.options('*', cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static('.'));

// Health Check
app.get('/', (req, res) => {
    res.status(200).send("Local Development Server Running. API Endpoints: /api/verify-serial-number, /api/proofs");
});

// --- Helper Funktionen für lokale Dateispeicherung ---
const PROOFS_FILE = path.join(STORAGE_PATH, 'data', 'proofs.json');
const IMAGES_DIR = path.join(STORAGE_PATH, 'images');

async function ensureStorageDirs() {
    try {
        await fs.mkdir(path.join(STORAGE_PATH, 'data'), { recursive: true });
        await fs.mkdir(IMAGES_DIR, { recursive: true });
    } catch (error) {
        console.error('Error creating storage directories:', error);
    }
}

async function loadProofsData() {
    try {
        const contents = await fs.readFile(PROOFS_FILE, 'utf-8');
        return JSON.parse(contents);
    } catch (error) {
        console.error('Error loading proofs:', error.message);
        return { proofs: [], lastUpdated: null };
    }
}

async function saveProofsData(data) {
    try {
        await fs.writeFile(PROOFS_FILE, JSON.stringify(data, null, 2), 'utf-8');
        return true;
    } catch (error) {
        console.error('Error saving proofs:', error);
        return false;
    }
}

async function uploadImage(buffer, originalFilename, mimeType, bagId) {
    try {
        const filename = `${bagId}_${originalFilename}`;
        const filepath = path.join(IMAGES_DIR, filename);

        await fs.writeFile(filepath, buffer);
        console.log(`Image saved: ${filepath}`);

        // Return local file path for serving
        return `/images/${filename}`;
    } catch (error) {
        console.error('Error uploading image:', error);
        throw error;
    }
}

// Serve images from local storage
app.get('/images/:filename', (req, res) => {
    const filepath = path.join(IMAGES_DIR, req.params.filename);
    res.sendFile(filepath);
});

// Mehrheitsprinzip-Funktion für Version und Packer
function applyMajorityPrinciple(bags) {
    if (!bags || bags.length === 0) return bags;

    const versions = bags.map(b => b.version).filter(v => v && v !== 'UNKNOWN');
    const majorityVersion = getMostFrequent(versions);

    const packers = bags.map(b => b.packer).filter(p => p && p !== 'UNKNOWN');
    const majorityPacker = getMostFrequent(packers);

    return bags.map(bag => ({
        ...bag,
        version: (bag.version === 'UNKNOWN' && majorityVersion) ? majorityVersion : bag.version,
        packer: (bag.packer === 'UNKNOWN' && majorityPacker) ? majorityPacker : bag.packer
    }));
}

function getMostFrequent(arr) {
    if (arr.length === 0) return null;
    const counts = {};
    arr.forEach(item => {
        counts[item] = (counts[item] || 0) + 1;
    });
    return Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);
}

// Authentifizierungs-Middleware
function authenticate(req, res, next) {
    const token = req.header('X-Auth-Token');
    if (!token || !AUTH_TOKENS[token]) {
        console.warn("Unauthorized Access Attempt detected.");
        return res.status(401).json({ error: 'Unauthorized: Invalid or missing X-Auth-Token header.' });
    }
    // Speichere den zugehörigen Packer für spätere Verwendung
    req.tokenPacker = AUTH_TOKENS[token];
    next();
}

// =====================================================
// ÖFFENTLICHE API ENDPOINTS (ohne Auth)
// =====================================================

// GET /api/proofs - Alle Proofs öffentlich abrufen
app.get('/api/proofs', async (req, res) => {
    try {
        console.log("GET /api/proofs - Lade öffentliche Proofs");
        const data = await loadProofsData();
        res.json(data);
    } catch (error) {
        console.error("Fehler beim Laden der Proofs:", error);
        res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
});

// GET /api/proofs/:bagId - Einzelnen Proof abrufen
app.get('/api/proofs/:bagId', async (req, res) => {
    try {
        const { bagId } = req.params;
        const data = await loadProofsData();
        const proof = data.proofs.find(p => p.bagId === bagId);

        if (!proof) {
            return res.status(404).json({ error: 'Proof not found' });
        }

        res.json(proof);
    } catch (error) {
        console.error("Fehler beim Laden des Proofs:", error);
        res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
});

// =====================================================
// GESCHÜTZTE API ENDPOINTS (mit Auth)
// =====================================================

// POST /api/proofs - Neuen Proof erstellen (mit Bild-Upload)
app.post('/api/proofs', authenticate, upload.single('image'), async (req, res) => {
    try {
        console.log("POST /api/proofs - Erstelle neuen Proof");

        const { bagId, version, packer, date, hash, otsData, status, blockHeight, blockTime, blockTimeFormatted } = req.body;

        if (!bagId) {
            return res.status(400).json({ error: 'bagId is required' });
        }

        // Lade existierende Daten
        const data = await loadProofsData();

        // Prüfe ob BagId bereits existiert
        const existingIndex = data.proofs.findIndex(p => p.bagId === bagId);

        let imageUrl = null;

        // Bild hochladen falls vorhanden
        if (req.file) {
            console.log(`Uploading image: ${req.file.originalname} (${req.file.mimetype}, ${req.file.size} bytes)`);
            imageUrl = await uploadImage(
                req.file.buffer,
                req.file.originalname,
                req.file.mimetype,
                bagId
            );
            console.log(`Image uploaded: ${imageUrl}`);
        }

        // Validierung: Warnung wenn KI-Packer nicht zum Token-Packer passt
        const detectedPacker = packer || 'Unknown';
        if (detectedPacker !== 'Unknown' && detectedPacker !== req.tokenPacker) {
            console.warn(`[WARNING] Packer mismatch for bag ${bagId}: AI detected "${detectedPacker}", but token belongs to "${req.tokenPacker}"`);
        }

        const proof = {
            bagId,
            version: version || 'Unknown',
            packer: detectedPacker,
            sealedBy: req.tokenPacker,
            date: date || new Date().toISOString(),
            hash: hash || null,
            otsData: otsData || null,
            status: status || 'pending',
            blockHeight: blockHeight || null,
            blockTime: blockTime || null,
            blockTimeFormatted: blockTimeFormatted || null,
            imageUrl: imageUrl,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        if (existingIndex >= 0) {
            // Update existierenden Proof (behalte altes Bild und sealedBy wenn kein neues)
            if (!imageUrl && data.proofs[existingIndex].imageUrl) {
                proof.imageUrl = data.proofs[existingIndex].imageUrl;
            }
            proof.createdAt = data.proofs[existingIndex].createdAt;
            // Behalte ursprüngliches sealedBy wenn vorhanden
            if (data.proofs[existingIndex].sealedBy) {
                proof.sealedBy = data.proofs[existingIndex].sealedBy;
            }
            data.proofs[existingIndex] = proof;
        } else {
            // Neuen Proof hinzufügen
            data.proofs.push(proof);
        }

        data.lastUpdated = new Date().toISOString();

        const saved = await saveProofsData(data);
        if (!saved) {
            return res.status(500).json({ error: 'Failed to save proof' });
        }

        res.status(201).json(proof);
    } catch (error) {
        console.error("Fehler beim Erstellen des Proofs:", error);
        res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
});

// PUT /api/proofs/:bagId - Proof aktualisieren (z.B. Timestamp-Status)
app.put('/api/proofs/:bagId', authenticate, async (req, res) => {
    try {
        const { bagId } = req.params;
        const updates = req.body;

        const data = await loadProofsData();
        const index = data.proofs.findIndex(p => p.bagId === bagId);

        if (index < 0) {
            return res.status(404).json({ error: 'Proof not found' });
        }

        // Aktualisiere nur die übergebenen Felder
        data.proofs[index] = {
            ...data.proofs[index],
            ...updates,
            updatedAt: new Date().toISOString()
        };

        data.lastUpdated = new Date().toISOString();

        const saved = await saveProofsData(data);
        if (!saved) {
            return res.status(500).json({ error: 'Failed to update proof' });
        }

        res.json(data.proofs[index]);
    } catch (error) {
        console.error("Fehler beim Aktualisieren des Proofs:", error);
        res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
});

// DELETE /api/proofs/:bagId - Proof löschen
app.delete('/api/proofs/:bagId', authenticate, async (req, res) => {
    try {
        const { bagId } = req.params;

        const data = await loadProofsData();
        const index = data.proofs.findIndex(p => p.bagId === bagId);

        if (index < 0) {
            return res.status(404).json({ error: 'Proof not found' });
        }

        // Lösche auch das Bild aus lokalem Speicher
        const proof = data.proofs[index];
        if (proof.imageUrl) {
            try {
                const imagePath = path.join(IMAGES_DIR, path.basename(proof.imageUrl));
                await fs.unlink(imagePath);
                console.log(`Deleted image: ${imagePath}`);
            } catch (imgError) {
                console.warn('Could not delete image:', imgError.message);
            }
        }

        data.proofs.splice(index, 1);
        data.lastUpdated = new Date().toISOString();

        const saved = await saveProofsData(data);
        if (!saved) {
            return res.status(500).json({ error: 'Failed to delete proof' });
        }

        res.json({ success: true, message: 'Proof deleted' });
    } catch (error) {
        console.error("Fehler beim Löschen des Proofs:", error);
        res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
});

// =====================================================
// GEMINI ENDPOINT
// =====================================================

app.post('/api/verify-serial-number', authenticate, async (req, res) => {
    if (!GEMINI_API_KEY || GEMINI_API_KEY === "demo-key-for-testing") {
        return res.status(500).json({ error: 'KI-API Key nicht auf dem Server konfiguriert. Set GEMINI_API_KEY environment variable.' });
    }

    try {
        console.log("Anfrage am /api/verify-serial-number empfangen und authentifiziert.");

        const { data: base64Data, mimeType } = req.body;

        if (!base64Data || !mimeType) {
            return res.status(400).json({ error: 'Fehlende Base64-Daten oder mimeType im Body.' });
        }

        const prompt = `Du bist ein hochpräziser OCR-Analyst für Specter Hardware Wallet Verpackungen (Tamper-Evident Bags).

Extrahiere die folgenden Informationen von JEDEM sichtbaren Bag auf dem Foto und gib sie als JSON-Array zurück:

1. **bagId**: Die Bag ID (eindeutige Nummer auf dem Beutel)
2. **version**: Die Firmware-Version. Steht als "Firmware: v1.9.0" auf dem Bag. Extrahiere NUR den Teil "v1.9.0" (ohne "Firmware:"). Falls nicht lesbar, setze auf "UNKNOWN".
3. **packer**: Der Verpacker. Steht meist als "by Schnuartz" oder "von Schnuartz" auf dem Bag. Extrahiere NUR den Namen (z.B. "Schnuartz"). Falls nicht lesbar, setze auf "UNKNOWN".

WICHTIG: Bekannte Verpacker sind: "Schnuartz"

Beispiel für die gewünschte JSON-Ausgabe:
[
    { "bagId": "12345", "version": "v1.9.0", "packer": "Schnuartz" },
    { "bagId": "67890", "version": "v1.8.5", "packer": "UNKNOWN" }
]
`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [
                { role: "user", parts: [{ text: prompt }] },
                { role: "user", parts: [{ inlineData: { data: base64Data, mimeType: mimeType } }] }
            ],
            config: {
                responseMimeType: "application/json"
            }
        });

        const jsonText = response.candidates[0].content.parts[0].text;
        const result = JSON.parse(jsonText);
        const processedResult = applyMajorityPrinciple(result);

        console.log("KI-Analyse erfolgreich abgeschlossen.");
        res.json(processedResult);

    } catch (error) {
        console.error("Fehler während der KI-Verarbeitung:", error);
        res.status(500).json({ error: 'Internal Server Error during AI processing.', details: error.message });
    }
});

// =====================================================
// OPENTIMESTAMPS BACKGROUND VERIFICATION
// =====================================================

// Helper functions for hex/bytes conversion
function hexToBytes(hex) {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
    }
    return bytes;
}

function bytesToHex(bytes) {
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Extract Bitcoin attestations directly from OTS file structure
function extractBitcoinAttestations(timestamp) {
    const attestations = [];

    function walkTimestamp(ts) {
        if (!ts) return;

        // Check for attestations
        if (ts.attestations && ts.attestations.length > 0) {
            for (const att of ts.attestations) {
                // BitcoinBlockHeaderAttestation has a 'height' property
                if (att.height !== undefined) {
                    attestations.push({
                        blockHeight: att.height,
                        blockTime: att.time || null
                    });
                }
            }
        }

        // Walk through ops
        if (ts.ops && ts.ops.size > 0) {
            for (const [op, nextTs] of ts.ops) {
                walkTimestamp(nextTs);
            }
        }
    }

    walkTimestamp(timestamp);
    return attestations;
}

// Upgrade and verify a single timestamp
async function upgradeAndVerifyTimestamp(proof) {
    try {
        if (!proof.otsData || !proof.hash) {
            return null;
        }

        const otsBytes = hexToBytes(proof.otsData);

        // Deserialize the OTS file
        const detachedOts = OpenTimestamps.DetachedTimestampFile.deserialize(otsBytes);

        // Try to upgrade (get attestation from calendar servers)
        let upgraded = false;
        try {
            upgraded = await OpenTimestamps.upgrade(detachedOts);
            if (upgraded) {
                console.log(`[OTS] Timestamp upgraded for bag ${proof.bagId}`);
            }
        } catch (upgradeError) {
            // Upgrade might fail if already upgraded or network issues
            console.log(`[OTS] Upgrade attempt for bag ${proof.bagId}: ${upgradeError.message || 'no change'}`);
        }

        // After upgrade, try to extract Bitcoin attestations directly from the OTS file
        // This avoids the need to contact a Bitcoin node
        const attestations = extractBitcoinAttestations(detachedOts.timestamp);

        if (attestations.length > 0) {
            const att = attestations[0]; // Use first attestation
            const blockHeight = String(att.blockHeight);

            // If we have block time from attestation, use it
            // Otherwise we need to fetch it (or use a placeholder)
            let blockTime = att.blockTime;
            let blockTimeFormatted = null;

            if (blockTime) {
                const date = new Date(blockTime * 1000);
                if (!isNaN(date.getTime())) {
                    blockTimeFormatted = date.toLocaleString('en-US');
                    blockTime = date.toISOString();
                }
            }

            // If no time available, fetch from mempool.space API
            if (!blockTimeFormatted) {
                try {
                    const response = await fetch(`https://mempool.space/api/block-height/${att.blockHeight}`);
                    if (response.ok) {
                        const blockHash = await response.text();
                        const blockResponse = await fetch(`https://mempool.space/api/block/${blockHash}`);
                        if (blockResponse.ok) {
                            const blockData = await blockResponse.json();
                            if (blockData.timestamp) {
                                const date = new Date(blockData.timestamp * 1000);
                                blockTime = date.toISOString();
                                blockTimeFormatted = date.toLocaleString('en-US');
                            }
                        }
                    }
                } catch (fetchError) {
                    console.log(`[OTS] Could not fetch block time: ${fetchError.message}`);
                    // Use current time as fallback display
                    const now = new Date();
                    blockTime = now.toISOString();
                    blockTimeFormatted = `Block #${blockHeight} (time unknown)`;
                }
            }

            console.log(`[OTS] Found Bitcoin attestation: block ${blockHeight}`);

            return {
                status: 'verified',
                blockHeight: blockHeight,
                blockTime: blockTime,
                blockTimeFormatted: blockTimeFormatted || `Block #${blockHeight}`,
                otsData: bytesToHex(detachedOts.serializeToBytes())
            };
        }

        // Not verified yet, but return upgraded OTS data if available
        if (upgraded) {
            return {
                status: 'pending',
                otsData: bytesToHex(detachedOts.serializeToBytes())
            };
        }

        return null;
    } catch (error) {
        console.error(`[OTS] Error verifying timestamp for bag ${proof.bagId}:`, error.message);
        return null;
    }
}

// Check all pending timestamps
async function checkPendingTimestamps() {
    try {
        const data = await loadProofsData();
        const pendingProofs = data.proofs.filter(p => p.status === 'pending' && p.otsData && p.hash);

        if (pendingProofs.length === 0) {
            return; // No pending proofs to check
        }

        console.log(`[OTS] Checking ${pendingProofs.length} pending timestamp(s)...`);

        let updated = false;

        for (const proof of pendingProofs) {
            const result = await upgradeAndVerifyTimestamp(proof);

            if (result) {
                const index = data.proofs.findIndex(p => p.bagId === proof.bagId);
                if (index >= 0) {
                    // Update proof with verification result
                    data.proofs[index] = {
                        ...data.proofs[index],
                        status: result.status,
                        otsData: result.otsData,
                        blockHeight: result.blockHeight || null,
                        blockTime: result.blockTime || null,
                        blockTimeFormatted: result.blockTimeFormatted || null,
                        updatedAt: new Date().toISOString()
                    };
                    updated = true;

                    if (result.status === 'verified') {
                        console.log(`[OTS] ✓ Bag ${proof.bagId} verified at block ${result.blockHeight}`);
                    }
                }
            }
        }

        if (updated) {
            data.lastUpdated = new Date().toISOString();
            await saveProofsData(data);
            console.log(`[OTS] Proofs data saved.`);
        }
    } catch (error) {
        console.error('[OTS] Error checking pending timestamps:', error.message);
    }
}

// Start background verification job (runs every 60 seconds)
const OTS_CHECK_INTERVAL = 60 * 1000; // 1 minute

function startTimestampVerificationJob() {
    console.log(`[OTS] Starting timestamp verification job (interval: ${OTS_CHECK_INTERVAL / 1000}s)`);

    // Run immediately on startup
    setTimeout(() => {
        checkPendingTimestamps();
    }, 5000); // Wait 5 seconds after startup

    // Then run every minute
    setInterval(() => {
        checkPendingTimestamps();
    }, OTS_CHECK_INTERVAL);
}

// Initialize storage and start server
ensureStorageDirs().then(() => {
    console.log("Storage directories initialized");

    app.listen(PORT, () => {
        console.log(`\n================================`);
        console.log(`✓ Local Server running on port ${PORT}`);
        console.log(`================================`);
        console.log(`\n📝 Demo Token: "demo-token"`);
        console.log(`📝 Demo Packer: "Schnuartz"`);
        console.log(`\n🌐 Frontend: http://localhost:3000 or http://localhost:5500`);
        console.log(`🔌 Backend: http://localhost:${PORT}`);
        console.log(`\n⚠️  To use Gemini AI image analysis:`);
        console.log(`   export GEMINI_API_KEY="your-actual-key"\n`);

        // Start the background verification job after server is ready
        startTimestampVerificationJob();
    });
});
