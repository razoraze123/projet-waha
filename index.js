import express from 'express';
import makeWASocket, { useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pino from 'pino';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3001;

// Configuration
const SESSIONS_DIR = path.join(__dirname, 'sessions_data');
const STATS_FILE = path.join(SESSIONS_DIR, 'stats.json');

// Assurer que le dossier de sessions existe
if (!fs.existsSync(SESSIONS_DIR)) {
    fs.mkdirSync(SESSIONS_DIR, { recursive: true });
}

// Initialiser le fichier de stats s'il n'existe pas
if (!fs.existsSync(STATS_FILE)) {
    fs.writeFileSync(STATS_FILE, JSON.stringify({ totalMessagesSent: 0, startTime: new Date().toISOString() }, null, 2));
}

function getGlobalStats() {
    try {
        if (fs.existsSync(STATS_FILE)) {
            return JSON.parse(fs.readFileSync(STATS_FILE, 'utf-8'));
        }
    } catch (e) {
        console.error("Erreur lecture stats:", e);
    }
    return { totalMessagesSent: 0, startTime: new Date().toISOString() };
}

function updateGlobalStats(updateFn) {
    const stats = getGlobalStats();
    const newStats = updateFn(stats);
    fs.writeFileSync(STATS_FILE, JSON.stringify(newStats, null, 2));
    return newStats;
}

app.use(cors());
app.use(express.json());

// Logger simple vers fichier
const logFile = fs.createWriteStream(path.join(__dirname, 'server.log'), { flags: 'a' });
function fileLog(message) {
    const logLine = `[${new Date().toISOString()}] ${message}\n`;
    logFile.write(logLine);
    // console.log(message); // Décommenter si on veut aussi voir dans la console
}

// Store sessions in memory (active sockets)
const sessions = new Map();

/**
 * Sauvegarde les métadonnées de la session (Nom, Numéro)
 */
function saveSessionMetadata(sessionId, metadata) {
    const sessionDir = path.join(SESSIONS_DIR, sessionId);
    if (!fs.existsSync(sessionDir)) {
        fs.mkdirSync(sessionDir, { recursive: true });
    }
    const metadataPath = path.join(sessionDir, 'metadata.json');
    
    // Lire les métadonnées existantes pour ne pas écraser
    let existingData = {};
    if (fs.existsSync(metadataPath)) {
        try {
            existingData = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
        } catch (e) {}
    }

    const newData = { ...existingData, ...metadata };
    fs.writeFileSync(metadataPath, JSON.stringify(newData, null, 2));
}

/**
 * Récupère les métadonnées d'une session
 */
function getSessionMetadata(sessionId) {
    const metadataPath = path.join(SESSIONS_DIR, sessionId, 'metadata.json');
    if (fs.existsSync(metadataPath)) {
        try {
            return JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
        } catch (e) {
            return {};
        }
    }
    return {};
}

/**
 * Initialize a WhatsApp session
 */
async function initSession(sessionId, name = null) {
    // Si pas de nom fourni, essayer de le récupérer des métadonnées stockées
    if (!name) {
        const meta = getSessionMetadata(sessionId);
        name = meta.name || `Session ${sessionId}`;
    }

    // Sauvegarder le nom initial si ce n'est pas déjà fait
    saveSessionMetadata(sessionId, { name, id: sessionId });

    const authPath = path.join(SESSIONS_DIR, sessionId, 'auth_info');
    const { state, saveCreds } = await useMultiFileAuthState(authPath);

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        browser: ["Niamey API", "Chrome", "1.0.0"],
        logger: pino({ level: "error" }), // On active les erreurs pour débugger
        // Optimisations pour la reconnexion
        connectTimeoutMs: 60000,
        keepAliveIntervalMs: 10000,
        emitOwnEvents: false,
        retryRequestDelayMs: 250
    });

    // Update session state in memory
    sessions.set(sessionId, {
        sock,
        status: 'connecting',
        qr: null,
        name,
        lastActive: new Date().toISOString()
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        const session = sessions.get(sessionId);

        if (session) {
            if (qr) {
                session.qr = qr;
                session.status = 'connecting';
                console.log(`QR Code pour session ${sessionId} (${name})`);
            }

            if (connection === 'close') {
                const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
                const reason = lastDisconnect?.error?.output?.statusCode || lastDisconnect?.error?.message;
                const errorDetail = lastDisconnect?.error?.toString();
                
                fileLog(`Session ${sessionId} fermée. Raison: ${reason}. Détail: ${errorDetail}`);

                // Ignorer les déconnexions "intentionnelles" ou logout
                if (reason === DisconnectReason.loggedOut) {
                   console.log(`Session ${sessionId} déconnectée (Log out).`);
                   session.status = 'disconnected';
                   session.qr = null;
                   // Optionnel: Supprimer la session ici si vous voulez qu'elle disparaisse après un logout
                } else {
                    console.log(`Session ${sessionId} fermée (Raison: ${reason}). Reconnexion...`);
                    if (shouldReconnect) {
                        setTimeout(() => {
                            // On relance en gardant le même nom
                            initSession(sessionId, name);
                        }, 3000); // Délai un peu plus court
                    } else {
                        session.status = 'disconnected';
                    }
                }
            } else if (connection === 'open') {
                console.log(`✅ Session ${sessionId} (${name}) CONNECTÉE !`);
                fileLog(`Session ${sessionId} connectée avec succès.`);
                session.status = 'connected';
                session.qr = null;
                session.lastActive = new Date().toISOString();

                const userJid = sock.user?.id;
                if (userJid) {
                    const phoneNumber = userJid.split(':')[0];
                    session.phoneNumber = phoneNumber;
                    // Persister le numéro de téléphone
                    saveSessionMetadata(sessionId, { phoneNumber });
                }
            }
        }
    });

    sock.ev.on('creds.update', saveCreds);
}

// --- API Routes ---

app.get('/api/stats', (req, res) => {
    const stats = getGlobalStats();
    res.json(stats);
});

app.get('/api/sessions', (req, res) => {
    const sessionList = Array.from(sessions.entries()).map(([id, session]) => ({
        id,
        name: session.name,
        status: session.status,
        qr: session.qr,
        lastActive: session.lastActive,
        phoneNumber: session.phoneNumber
    }));
    res.json(sessionList);
});

app.post('/api/sessions', async (req, res) => {
    const { name } = req.body;
    const sessionId = Date.now().toString();

    await initSession(sessionId, name || `Session ${sessionId}`);

    res.json({
        status: 'success',
        message: 'Session created',
        session: { id: sessionId, status: 'connecting' }
    });
});

app.get('/api/sessions/:id', (req, res) => {
    const session = sessions.get(req.params.id);
    if (!session) {
        return res.status(404).json({ error: 'Session not found' });
    }
    res.json({
        id: req.params.id,
        name: session.name,
        status: session.status,
        qr: session.qr,
        lastActive: session.lastActive,
        phoneNumber: session.phoneNumber
    });
});

app.delete('/api/sessions/:id', async (req, res) => {
    const sessionId = req.params.id;
    const session = sessions.get(sessionId);

    // 1. Fermer la connexion socket si elle existe
    if (session && session.sock) {
        session.sock.end(undefined);
    }
    
    // 2. Supprimer de la mémoire
    sessions.delete(sessionId);

    // 3. Supprimer les fichiers physiques
    const sessionDir = path.join(SESSIONS_DIR, sessionId);
    try {
        if (fs.existsSync(sessionDir)) {
            fs.rmSync(sessionDir, { recursive: true, force: true });
            console.log(`Dossier de session supprimé : ${sessionDir}`);
        }
        res.json({ status: 'success', message: 'Session deleted' });
    } catch (e) {
        console.error(`Erreur suppression dossier ${sessionId}`, e);
        res.status(500).json({ error: 'Failed to delete session files' });
    }
});

app.post('/api/send-message', async (req, res) => {
    const { sessionId, number, message } = req.body;

    if (!sessionId || !number || !message) {
        return res.status(400).json({ error: 'Missing sessionId, number, or message' });
    }

    const session = sessions.get(sessionId);
    if (!session || !session.sock) {
        return res.status(404).json({ error: 'Session not found or not initialized' });
    }

    if (session.status !== 'connected') {
        return res.status(400).json({ error: 'Session is not connected' });
    }

    try {
        const cleanNumber = number.replace(/\D/g, '');
        const jid = `${cleanNumber}@s.whatsapp.net`;
        
        await session.sock.sendMessage(jid, { text: message });
        
        // Mettre à jour les stats globales
        updateGlobalStats(stats => ({
            ...stats,
            totalMessagesSent: (stats.totalMessagesSent || 0) + 1
        }));
        
        fileLog(`Message envoyé avec succès via session ${sessionId} vers ${cleanNumber}`);
        res.json({ status: 'success', message: 'Message sent' });
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ error: 'Failed to send message', details: error.toString() });
    }
});

const frontendDist = path.join(__dirname, 'frontend/dist');
if (fs.existsSync(frontendDist)) {
    app.use(express.static(frontendDist));
    app.get('*', (req, res) => {
        res.sendFile(path.join(frontendDist, 'index.html'));
    });
} else {
    console.log("⚠️ Frontend build not found. Running API only mode.");
    app.get('/', (req, res) => res.send('API Running (Frontend not built)'));
}

// Fonction pour restaurer les sessions au démarrage
function restoreSessions() {
    if (!fs.existsSync(SESSIONS_DIR)) return;

    const files = fs.readdirSync(SESSIONS_DIR);
    console.log(`Tentative de restauration de ${files.length} sessions...`);

    files.forEach(sessionId => {
        // Vérifier si c'est bien un dossier
        const sessionPath = path.join(SESSIONS_DIR, sessionId);
        if (fs.statSync(sessionPath).isDirectory()) {
            initSession(sessionId).catch(err => {
                console.error(`Echec restauration session ${sessionId}:`, err);
            });
        }
    });
}

app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
    restoreSessions();
});