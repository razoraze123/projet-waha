import express from 'express';
import makeWASocket, { useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pino from 'pino';
import os from 'os';
import axios from 'axios';
import 'dotenv/config';

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
        } catch (e) {
            console.error('Erreur lors de la lecture des métadonnées :', e);
        }
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
    if (!name) {
        const meta = getSessionMetadata(sessionId);
        name = meta.name || `Session ${sessionId}`;
    }

    saveSessionMetadata(sessionId, { name, id: sessionId });

    const authPath = path.join(SESSIONS_DIR, sessionId, 'auth_info');
    const { state, saveCreds } = await useMultiFileAuthState(authPath);

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        browser: ["Niamey API", "Chrome", "1.0.0"],
        logger: pino({ level: "error" }),
        connectTimeoutMs: 60000,
        keepAliveIntervalMs: 10000,
        emitOwnEvents: false,
        retryRequestDelayMs: 250
    });

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

                if (reason === DisconnectReason.loggedOut) {
                   console.log(`Session ${sessionId} déconnectée (Log out).`);
                   session.status = 'disconnected';
                   session.qr = null;
                } else {
                    console.log(`Session ${sessionId} fermée (Raison: ${reason}). Reconnexion...`);
                    if (shouldReconnect) {
                        setTimeout(() => {
                            initSession(sessionId, name);
                        }, 3000);
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
                    saveSessionMetadata(sessionId, { phoneNumber });
                }
            }
        }
    });

    sock.ev.on('messages.upsert', async (m) => {
        try {
            const webhookUrl = process.env.WEBHOOK_URL;
            if (webhookUrl && m.messages && m.messages.length > 0) {
                const msg = m.messages[0];
                if (!msg.key.fromMe) {
                    await axios.post(webhookUrl, {
                        sessionId,
                        event: 'messages.upsert',
                        data: m
                    }).catch(err => {
                        console.error(`Erreur Webhook (${webhookUrl}):`, err.message);
                    });
                }
            }
        } catch (err) {
            console.error('Erreur processing webhook:', err);
        }
    });

    sock.ev.on('creds.update', saveCreds);
}

// --- API Routes ---

// Helper to validate session
function validateSession(sessionId, res) {
    const session = sessions.get(sessionId);
    if (!session || !session.sock) {
        res.status(404).json({ error: 'Session not found or not initialized' });
        return null;
    }
    if (session.status !== 'connected') {
        res.status(400).json({ error: 'Session is not connected' });
        return null;
    }
    return session;
}

// Helper to format JID
const formatJid = (number) => {
    if (!number) return null;
    const numStr = number.toString();
    if (numStr.includes('@')) {
        return numStr;
    }
    const cleanNumber = numStr.replace(/\D/g, '');
    return `${cleanNumber}@s.whatsapp.net`;
};

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

    if (session && session.sock) {
        session.sock.end(undefined);
    }
    
    sessions.delete(sessionId);

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

    const session = validateSession(sessionId, res);
    if (!session) return;

    try {
        const jid = formatJid(number);
        await session.sock.sendMessage(jid, { text: message });
        
        updateGlobalStats(stats => ({
            ...stats,
            totalMessagesSent: (stats.totalMessagesSent || 0) + 1
        }));
        
        fileLog(`Message envoyé avec succès via session ${sessionId} vers ${number}`);
        res.json({ status: 'success', message: 'Message sent' });
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ error: 'Failed to send message', details: error.toString() });
    }
});

// --- Chatting Actions ---

// POST /api/send-image
app.post('/api/send-image', async (req, res) => {
    const { sessionId, number, imageUrl, caption } = req.body;
    if (!sessionId || !number || !imageUrl) {
        return res.status(400).json({ error: 'Missing sessionId, number, or imageUrl' });
    }

    const session = validateSession(sessionId, res);
    if (!session) return;

    try {
        const jid = formatJid(number);
        let msgContent = {};

        if (imageUrl.startsWith('data:image') || (imageUrl.length > 1000 && !imageUrl.startsWith('http'))) {
            const base64Str = imageUrl.startsWith('data:image') ? imageUrl.split(',')[1] : imageUrl;
            msgContent = { image: Buffer.from(base64Str, 'base64') };
        } else {
            msgContent = { image: { url: imageUrl } };
        }

        msgContent.caption = caption || '';

        await session.sock.sendMessage(jid, msgContent);

        updateGlobalStats(stats => ({ ...stats, totalMessagesSent: (stats.totalMessagesSent || 0) + 1 }));
        res.json({ status: 'success', message: 'Image sent' });
    } catch (error) {
        console.error('Error sending image:', error);
        res.status(500).json({ error: 'Failed to send image', details: error.toString() });
    }
});

// POST /api/send-file
app.post('/api/send-file', async (req, res) => {
    const { sessionId, number, fileUrl, fileName, mimetype, caption } = req.body;
    if (!sessionId || !number || !fileUrl) {
        return res.status(400).json({ error: 'Missing sessionId, number, or fileUrl' });
    }

    const session = validateSession(sessionId, res);
    if (!session) return;

    try {
        const jid = formatJid(number);
        await session.sock.sendMessage(jid, {
            document: { url: fileUrl },
            mimetype: mimetype || 'application/octet-stream',
            fileName: fileName || 'file',
            caption: caption || ''
        });

        updateGlobalStats(stats => ({ ...stats, totalMessagesSent: (stats.totalMessagesSent || 0) + 1 }));
        res.json({ status: 'success', message: 'File sent' });
    } catch (error) {
        console.error('Error sending file:', error);
        res.status(500).json({ error: 'Failed to send file', details: error.toString() });
    }
});

// POST /api/send-voice
app.post('/api/send-voice', async (req, res) => {
    const { sessionId, number, audioUrl } = req.body;
    if (!sessionId || !number || !audioUrl) {
        return res.status(400).json({ error: 'Missing sessionId, number, or audioUrl' });
    }

    const session = validateSession(sessionId, res);
    if (!session) return;

    try {
        const jid = formatJid(number);
        await session.sock.sendMessage(jid, {
            audio: { url: audioUrl },
            ptt: true
        });

        updateGlobalStats(stats => ({ ...stats, totalMessagesSent: (stats.totalMessagesSent || 0) + 1 }));
        res.json({ status: 'success', message: 'Voice message sent' });
    } catch (error) {
        console.error('Error sending voice:', error);
        res.status(500).json({ error: 'Failed to send voice', details: error.toString() });
    }
});

// POST /api/send-location
app.post('/api/send-location', async (req, res) => {
    const { sessionId, number, latitude, longitude, name, address } = req.body;
    if (!sessionId || !number || !latitude || !longitude) {
        return res.status(400).json({ error: 'Missing sessionId, number, latitude, or longitude' });
    }

    const session = validateSession(sessionId, res);
    if (!session) return;

    try {
        const jid = formatJid(number);
        await session.sock.sendMessage(jid, {
            location: {
                degreesLatitude: parseFloat(latitude),
                degreesLongitude: parseFloat(longitude),
                name: name,
                address: address
            }
        });

        updateGlobalStats(stats => ({ ...stats, totalMessagesSent: (stats.totalMessagesSent || 0) + 1 }));
        res.json({ status: 'success', message: 'Location sent' });
    } catch (error) {
        console.error('Error sending location:', error);
        res.status(500).json({ error: 'Failed to send location', details: error.toString() });
    }
});

// POST /api/send-seen
app.post('/api/send-seen', async (req, res) => {
    const { sessionId, number, messageId, participant } = req.body;
    if (!sessionId || !number || !messageId) {
        return res.status(400).json({ error: 'Missing sessionId, number, or messageId' });
    }

    const session = validateSession(sessionId, res);
    if (!session) return;

    try {
        const jid = formatJid(number);
        const key = {
            remoteJid: jid,
            id: messageId,
            fromMe: false
        };
        if (participant) key.participant = participant;

        await session.sock.readMessages([key]);
        res.json({ status: 'success', message: 'Marked as seen' });
    } catch (error) {
        console.error('Error sending seen:', error);
        res.status(500).json({ error: 'Failed to mark as seen', details: error.toString() });
    }
});

// POST /api/start-typing
app.post('/api/start-typing', async (req, res) => {
    const { sessionId, number } = req.body;
    if (!sessionId || !number) {
        return res.status(400).json({ error: 'Missing sessionId or number' });
    }

    const session = validateSession(sessionId, res);
    if (!session) return;

    try {
        const jid = formatJid(number);
        await session.sock.sendPresenceUpdate('composing', jid);
        res.json({ status: 'success', message: 'Typing started' });
    } catch (error) {
        console.error('Error start typing:', error);
        res.status(500).json({ error: 'Failed to start typing', details: error.toString() });
    }
});

// POST /api/stop-typing
app.post('/api/stop-typing', async (req, res) => {
    const { sessionId, number } = req.body;
    if (!sessionId || !number) {
        return res.status(400).json({ error: 'Missing sessionId or number' });
    }

    const session = validateSession(sessionId, res);
    if (!session) return;

    try {
        const jid = formatJid(number);
        await session.sock.sendPresenceUpdate('paused', jid);
        res.json({ status: 'success', message: 'Typing stopped' });
    } catch (error) {
        console.error('Error stop typing:', error);
        res.status(500).json({ error: 'Failed to stop typing', details: error.toString() });
    }
});

// POST /api/react
app.post('/api/react', async (req, res) => {
    const { sessionId, number, text, key } = req.body;
    if (!sessionId || !number || !text || !key) {
        return res.status(400).json({ error: 'Missing sessionId, number, text, or key' });
    }

    const session = validateSession(sessionId, res);
    if (!session) return;

    try {
        const jid = formatJid(number);
        const reactionKey = {
            remoteJid: jid,
            id: key.id || key,
            fromMe: key.fromMe !== undefined ? key.fromMe : false
        };
        if (key.participant) reactionKey.participant = key.participant;

        await session.sock.sendMessage(jid, {
            react: {
                text: text,
                key: reactionKey
            }
        });
        res.json({ status: 'success', message: 'Reaction sent' });
    } catch (error) {
        console.error('Error sending reaction:', error);
        res.status(500).json({ error: 'Failed to send reaction', details: error.toString() });
    }
});

// POST /api/check-number
app.post('/api/check-number', async (req, res) => {
    const { sessionId, number } = req.body;
    if (!sessionId || !number) {
        return res.status(400).json({ error: 'Missing sessionId or number' });
    }

    const session = validateSession(sessionId, res);
    if (!session) return;

    try {
        const jid = formatJid(number);
        const [result] = await session.sock.onWhatsApp(jid);

        if (result && result.exists) {
            res.json({ status: 'success', exists: true, jid: result.jid });
        } else {
            res.json({ status: 'success', exists: false });
        }
    } catch (error) {
        console.error('Error checking number:', error);
        res.status(500).json({ error: 'Failed to check number', details: error.toString() });
    }
});

// GET /api/contact/profile-pic
app.get('/api/contact/profile-pic', async (req, res) => {
    const { sessionId, number } = req.query;
    if (!sessionId || !number) {
        return res.status(400).json({ error: 'Missing sessionId or number' });
    }

    const session = validateSession(sessionId, res);
    if (!session) return;

    try {
        const jid = formatJid(number);
        const ppUrl = await session.sock.profilePictureUrl(jid, 'image').catch(() => null);

        if (ppUrl) {
            res.json({ status: 'success', imageUrl: ppUrl });
        } else {
            res.status(404).json({ error: 'Profile picture not found' });
        }
    } catch (error) {
        console.error('Error getting profile pic:', error);
        res.status(500).json({ error: 'Failed to get profile pic', details: error.toString() });
    }
});

// GET /api/groups
app.get('/api/groups', async (req, res) => {
    const { sessionId } = req.query;
    if (!sessionId) {
        return res.status(400).json({ error: 'Missing sessionId' });
    }

    const session = validateSession(sessionId, res);
    if (!session) return;

    try {
        const groups = await session.sock.groupFetchAllParticipating();
        const groupList = Object.keys(groups).map(key => groups[key]);
        res.json({ status: 'success', groups: groupList });
    } catch (error) {
        console.error('Error fetching groups:', error);
        res.status(500).json({ error: 'Failed to fetch groups', details: error.toString() });
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