const { Client, LocalAuth } = require('whatsapp-web.js');

console.log('Starting standalone test with require...');

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
    require('fs').writeFileSync('test_error.txt', err.stack || err.toString());
    process.exit(1);
});
