import express from 'express';
import makeWASocket, { useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());

// Store sessions in memory
// Map<sessionId, { sock: any, status: string, qr: string | null, name: string }>
const sessions = new Map();

/**
 * Initialize a WhatsApp session
 */
async function initSession(sessionId, name = `Session ${sessionId}`) {
    const authPath = path.join(__dirname, `auth_info_baileys_${sessionId}`);
    const { state, saveCreds } = await useMultiFileAuthState(authPath);

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        browser: ["Niamey API", "Chrome", "1.0.0"]
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
                session.qr = qr;
                session.status = 'connecting';
            }

            if (connection === 'close') {
                const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
                console.log(`Session ${sessionId} closed. Reconnecting: ${shouldReconnect}`);

                if (shouldReconnect) {
                    initSession(sessionId, name);
                } else {
                    session.status = 'disconnected';
                    session.qr = null;
                    // Optional: Cleanup if logged out
                    // sessions.delete(sessionId);
                }
            } else if (connection === 'open') {
                console.log(`Session ${sessionId} opened`);
                session.status = 'connected';
                session.qr = null;
                session.lastActive = new Date().toISOString();

                // Try to get phone number
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

// Get all sessions
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

// Create a new session
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

// Get specific session info (useful for polling QR)
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

// Delete a session
app.delete('/api/sessions/:id', async (req, res) => {
    const sessionId = req.params.id;
    const session = sessions.get(sessionId);

    if (session) {
        if (session.sock) {
            session.sock.end(undefined);
        }
        sessions.delete(sessionId);

        // Remove auth folder
        const authPath = path.join(__dirname, `auth_info_baileys_${sessionId}`);
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

// Send message
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
        const cleanNumber = number.replace(/\D/g, ''); // Remove non-digits
        const jid = `${cleanNumber}@s.whatsapp.net`;
        
        await session.sock.sendMessage(jid, { text: message });
        res.json({ status: 'success', message: 'Message sent' });
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ error: 'Failed to send message', details: error.toString() });
    }
});

// Serve Frontend Static Files
const frontendDist = path.join(__dirname, 'frontend/dist');
app.use(express.static(frontendDist));

// Handle React Routing (return index.html for unknown routes)
app.get('*', (req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
});

// Start Server
app.listen(port, () => {
    console.log(`Server listening on port ${port}`);

    // Restore existing sessions if we had persistence logic (not implemented here for simplicity,
    // but could scan for auth_info_baileys_* folders)
    const files = fs.readdirSync(__dirname);
    files.forEach(file => {
        if (file.startsWith('auth_info_baileys_')) {
            const sessionId = file.replace('auth_info_baileys_', '');
            console.log(`Restoring session ${sessionId}...`);
            initSession(sessionId, `Restored Session ${sessionId}`);
        }
    });
});
