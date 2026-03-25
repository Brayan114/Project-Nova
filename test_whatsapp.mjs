import { Client, LocalAuth } from 'whatsapp-web.js';

console.log('Starting standalone test...');

const whatsappClient = new Client({
    authStrategy: new LocalAuth({ dataPath: './.wwebjs_auth' }),
    puppeteer: {
        executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

whatsappClient.on('qr', (qr) => {
    console.log('QR RECEIVED:', qr);
    process.exit(0);
});

whatsappClient.on('ready', () => {
    console.log('READY');
    process.exit(0);
});

whatsappClient.on('disconnected', (reason) => {
    console.log('DISCONNECTED', reason);
    process.exit(1);
});

whatsappClient.initialize().then(() => {
    console.log('Initialize promise resolved.');
}).catch((err) => {
    console.error('Initialize error:', err);
    process.exit(1);
});
