import express from 'express';
import makeWASocket, { useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';

const app = express();
const port = 3001;

app.use(express.json());

let sock;

/**
 * Establishes a connection to WhatsApp using the Baileys library.
 *
 * This function handles the entire connection lifecycle:
 * - Loads authentication credentials from the 'auth_info_baileys' directory.
 * - Creates a new Baileys socket connection.
 * - Generates and displays a QR code in the terminal for authentication if needed.
 * - Handles connection updates (open, close, reconnecting).
 * - Saves updated credentials to the file system.
 *
 * If the connection closes due to a non-logout error, it attempts to reconnect automatically.
 *
 * @async
 * @function connectToWhatsApp
 * @returns {Promise<void>} A promise that resolves when the setup is complete (though the connection itself runs asynchronously).
 */
async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    sock = makeWASocket({
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

/**
 * Health check endpoint.
 *
 * Returns a simple message indicating that the WhatsApp API service is running.
 *
 * @name GET /
 * @function
 * @param {express.Request} req - The Express request object.
 * @param {express.Response} res - The Express response object.
 * @returns {void}
 */
app.get('/', (req, res) => {
    res.send('WhatsApp API is running');
});

/**
 * Sends a text message to a specified WhatsApp number.
 *
 * This endpoint accepts a JSON body containing the target phone number and the message content.
 * It uses the active Baileys socket connection to send the message.
 *
 * @name POST /send-text
 * @function
 * @param {express.Request} req - The Express request object.
 * @param {express.Response} res - The Express response object.
 * @param {Object} req.body - The body of the request.
 * @param {string} req.body.number - The recipient's phone number. Should be the country code + number (e.g., "1234567890"). Do not include "@s.whatsapp.net".
 * @param {string} req.body.message - The text message content to send.
 * @returns {void} Responds with a JSON object indicating success or failure.
 */
app.post('/send-text', async (req, res) => {
    const { number, message } = req.body;

    if (!sock) {
        return res.status(500).json({ status: 'error', message: 'WhatsApp not connected' });
    }

    try {
        const jid = `${number}@s.whatsapp.net`;
        await sock.sendMessage(jid, { text: message });
        res.json({ status: 'success', message: 'Message sent' });
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ status: 'error', message: 'Failed to send message', error: error.toString() });
    }
});

/**
 * Starts the Express server.
 *
 * Listens on the configured port and logs a message to the console.
 *
 * @function
 */
app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});
