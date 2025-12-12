console.log("Starting up ...")
// --- Umgebungsvariablen laden und prüfen ---
// Diese Variablen werden von Cloud Run automatisch bereitgestellt, wenn sie konfiguriert sind.
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const AUTH_TOKEN = process.env.AUTH_TOKEN;
// Cloud Run verlangt, dass der Server auf dem durch die Umgebungsvariable PORT definierten Port läuft.
const PORT = process.env.PORT || 8080;

// Prüfen Sie, ob die kritischen Variablen vorhanden sind.
if (!GEMINI_API_KEY || !AUTH_TOKEN) {
    // ACHTUNG: Wir verwenden kein process.exit() mehr hier, um den Server am Laufen zu halten,
    // damit Cloud Run einen ordentlichen 500er-Fehler ausgibt, falls die Keys fehlen.
    console.error("FATAL ERROR: GEMINI_API_KEY oder AUTH_TOKEN fehlt in den Umgebungsvariablen. KI-Funktion wird fehlschlagen.");
    process.exit(1); // Entfernt, um Server zu starten, um 500er-Fehler
}

// --- Importe ---
import express from 'express';
// Wir benötigen @google/genai, nicht @google/genai-ai
import { GoogleGenAI } from '@google/genai';
import cors from 'cors'; // Für die Cross-Origin-Kommunikation

// --- Initialisierung ---
const app = express();
console.log("Connecting to Gemini ...");
// Initialisiert die KI mit dem Key (wird automatisch als undefiniert behandelt, falls Key fehlt)
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY }); 

// --- Middleware ---
console.log("Configuring middleware ...");
// 1. CORS-Konfiguration: Erlaubt Anfragen von JEDER Domain (*). 
// Dies ist für das Debugging am einfachsten.
app.use(cors({
    origin: '*',
    methods: ['POST', 'GET'],
    allowedHeaders: ['Content-Type', 'X-Auth-Token']
}));

// 2. Body Parser: Erlaubt das Verarbeiten von JSON-Anfragen (bis zu 50MB für Bild-Base64)
app.use(express.json({ limit: '50mb' }));  

// 3. Health Check / Root Handler
// Wird aufgerufen, wenn Sie nur die Basis-URL eingeben.
app.get('/', (req, res) => {
    res.status(200).send("Proxy-Server läuft. Benutzen Sie den /api/verify-serial-number Endpunkt mit POST.");
});

// 4. Mehrheitsprinzip-Funktion für Version und Packer
function applyMajorityPrinciple(bags) {
    if (!bags || bags.length === 0) return bags;

    // Finde die häufigste Version (ohne UNKNOWN)
    const versions = bags.map(b => b.version).filter(v => v && v !== 'UNKNOWN');
    const majorityVersion = getMostFrequent(versions);

    // Finde den häufigsten Packer (ohne UNKNOWN)
    const packers = bags.map(b => b.packer).filter(p => p && p !== 'UNKNOWN');
    const majorityPacker = getMostFrequent(packers);

    // Ersetze UNKNOWN mit Mehrheitswerten
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

// 5. Authentifizierungs-Middleware
function authenticate(req, res, next) {
    const token = req.header('X-Auth-Token');

    if (!token || token !== AUTH_TOKEN) {
        console.warn("Unauthorized Access Attempt detected.");
        return res.status(401).json({ error: 'Unauthorized: Invalid or missing X-Auth-Token header.' });
    }
    next(); // Authentifizierung erfolgreich
}

// --- Haupt-API-Endpunkt ---
app.post('/api/verify-serial-number', authenticate, async (req, res) => {
    // Prüft, ob der KI-Key überhaupt gesetzt wurde
    if (!GEMINI_API_KEY) {
        return res.status(500).json({ error: 'KI-API Key nicht auf dem Server konfiguriert.' });
    }
    
    try {
        console.log("Anfrage am /api/verify-serial-number empfangen und authentifiziert.");

        const { data: base64Data, mimeType } = req.body;

        if (!base64Data || !mimeType) {
            return res.status(400).json({ error: 'Fehlende Base64-Daten oder mimeType im Body.' });
        }
        
        // Die Prompt-Anweisung an das Modell
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

        // KI-Aufruf mit Bilddaten
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash', 
            contents: [
                { role: "user", parts: [{ text: prompt }] },
                { role: "user", parts: [{ inlineData: { data: base64Data, mimeType: mimeType } }] }
            ],
            config: {
                // Erzwingt JSON-Ausgabe
                responseMimeType: "application/json"
            }
        }); 

        // Die Antwort ist ein JSON-String. Wir parsen ihn und senden ihn zurück.
        const jsonText = response.candidates[0].content.parts[0].text;
        const result = JSON.parse(jsonText);

        // Mehrheitsprinzip für Version und Packer anwenden
        const processedResult = applyMajorityPrinciple(result);

        console.log("KI-Analyse erfolgreich abgeschlossen.");
        res.json(processedResult);

    } catch (error) {
        console.error("Fehler während der KI-Verarbeitung:", error);
        // Sende einen 500er-Fehler zurück an das Frontend
        res.status(500).json({ error: 'Internal Server Error during AI processing.', details: error.message });
    }
});

console.log("Starting server ...");
// --- Server starten (Kritischer Teil, um exit(0) zu verhindern) ---
// Der Server muss auf dem Cloud Run PORT lauschen.
app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}. Environment: ${process.env.NODE_ENV}`);
});
// Wichtig: Es darf KEIN process.exit() Aufruf nach app.listen geben!
