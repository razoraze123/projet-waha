import express from 'express';
import makeWASocket, { useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pino from 'pino'; // <--- IMPORTE PINO
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());

// Store sessions in memory
const sessions = new Map();

/**
 * Initialize a WhatsApp session
 */
async function initSession(sessionId, name = `Session ${sessionId}`) {
    const authPath = path.join(os.tmpdir(), `niamey_clean_test_${sessionId}`);
    console.log("Stockage session temporaire ici :", authPath);
    const { state, saveCreds } = await useMultiFileAuthState(authPath);

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false, // On veut le voir sur le dashboard, pas dans le terminal
        browser: ["Niamey API", "Chrome", "1.0.0"],
        logger: pino({ level: "silent" }) // <--- MODE SILENCIEUX ACTIVÉ 🤫
    });

    // Update session state
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
                // On garde le QR pour l'envoyer au frontend
                session.qr = qr;
                session.status = 'connecting';
                // On affiche quand même un petit log propre
                console.log(`QR Code généré pour la session ${sessionId} (Voir Dashboard)`);
            }

            if (connection === 'close') {
                const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
                const reason = lastDisconnect?.error?.output?.statusCode || lastDisconnect?.error?.message;
                console.log(`❌ Session ${sessionId} fermée. Raison: ${reason}. Reconnexion dans 5s: ${shouldReconnect}`);

                if (shouldReconnect) {
                    // Ajout d'un délai pour éviter la boucle infinie rapide
                    setTimeout(() => {
                        initSession(sessionId, name);
                    }, 5000);
                } else {
                    session.status = 'disconnected';
                    session.qr = null;
                }
            } else if (connection === 'open') {
                console.log(`✅ Session ${sessionId} CONNECTÉE !`);
                session.status = 'connected';
                session.qr = null;
                session.lastActive = new Date().toISOString();

                const userJid = sock.user?.id;
                if (userJid) {
                    session.phoneNumber = userJid.split(':')[0];
                }
            }
        }
    });

    sock.ev.on('creds.update', saveCreds);
}

// --- API Routes ---

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

    if (session) {
        if (session.sock) {
            session.sock.end(undefined);
        }
        sessions.delete(sessionId);

        const authPath = path.join(__dirname, `niamey_session_${sessionId}`);
        try {
            fs.rmSync(authPath, { recursive: true, force: true });
        } catch (e) {
            console.error(`Failed to delete auth folder for ${sessionId}`, e);
        }

        res.json({ status: 'success', message: 'Session deleted' });
    } else {
        res.status(404).json({ error: 'Session not found' });
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
        res.json({ status: 'success', message: 'Message sent' });
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ error: 'Failed to send message', details: error.toString() });
    }
});

const frontendDist = path.join(__dirname, 'frontend/dist');
// Vérifie si le build existe avant de le servir pour éviter le crash
if (fs.existsSync(frontendDist)) {
    app.use(express.static(frontendDist));
    app.get('*', (req, res) => {
        res.sendFile(path.join(frontendDist, 'index.html'));
    });
} else {
    console.log("⚠️ Frontend build not found. Running API only mode.");
    app.get('/', (req, res) => res.send('API Running (Frontend not built)'));
}

app.listen(port, () => {
    console.log(`Server listening on port ${port}`);

    // Restauration automatique désactivée
    /*
    // Restauration des sessions
    const files = fs.readdirSync(__dirname);
    files.forEach(file => {
        if (file.startsWith('niamey_session_')) {
            const sessionId = file.replace('niamey_session_', '');
            console.log(`Restoring session ${sessionId}...`);
            initSession(sessionId, `Restored Session ${sessionId}`);
        }
    });
    */
});