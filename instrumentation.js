export async function register() {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        const { startHeartbeat } = await import('./lib/engine/heartbeat.js');
        startHeartbeat();

        const { initWhatsAppClient } = await import('./lib/clients/whatsapp.js');
        initWhatsAppClient();
    }
}
