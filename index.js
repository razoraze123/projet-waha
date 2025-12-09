import express from 'express';
import makeWASocket, { useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';

const app = express();
const port = 3001;

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false, // We use qrcode-terminal explicitly
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        if(qr) {
            console.log('Scan the QR code below:');
            qrcode.generate(qr, { small: true });
        }

        if(connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('connection closed due to ', lastDisconnect?.error, ', reconnecting ', shouldReconnect);
            if(shouldReconnect) {
                connectToWhatsApp();
            }
        } else if(connection === 'open') {
            console.log('opened connection');
        }
    });

    sock.ev.on('creds.update', saveCreds);
}

// Start WhatsApp connection
connectToWhatsApp();

// API Endpoint
app.get('/', (req, res) => {
    res.send('WhatsApp API is running');
});

// Start Express Server
app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});
