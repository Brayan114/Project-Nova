import { Client, LocalAuth } from 'whatsapp-web.js';
import qrcode from 'qrcode';
import prisma from '../prisma.js';
import { storeEpisodicMemory, storeSemanticMemory } from '../engine/memory.js';
import fs from 'fs';
import path from 'path';

const STATUS_FILE = path.join(process.cwd(), '.whatsapp_status.json');

function updateStatus(status, qrImage = null) {
    try {
        fs.writeFileSync(STATUS_FILE, JSON.stringify({ status, qrImage }));
    } catch (e) {
        console.error('Failed to write status file', e);
    }
}

// Singleton to prevent hot-reload from spawning multiple WhatsApp instances in Dev mode
let whatsappClient = global.whatsappClient;

export async function initWhatsAppClient() {
    if (whatsappClient) return;

    console.log('[NOVA WhatsApp Node] Initializing Observer Client...');

    // Kill any orphaned zombie Chrome processes from previous hot-reloads that might lock the session
    try {
        const { execSync } = await import('child_process');
        if (process.platform === 'win32') {
            execSync(`Get-CimInstance Win32_Process -Filter "Name = 'chrome.exe'" | Where-Object CommandLine -match "wwebjs_auth" | Invoke-CimMethod -MethodName Terminate`, { shell: 'powershell.exe' });
        }
    } catch (e) {
        // Ignore if no zombies found
    }

    // Create new client with LocalAuth so we don't have to scan the QR code every server restart
    whatsappClient = new Client({
        authStrategy: new LocalAuth({ dataPath: './.wwebjs_auth' }),
        puppeteer: {
            executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
            // Required flags for stable headless execution
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
        }
    });

    global.whatsappClient = whatsappClient;

    whatsappClient.on('qr', async (qr) => {
        console.log('[NOVA WhatsApp Node] QR Code Requested. Pending scan...');

        // Generate a base64 image of the QR code so we can display it nicely in the React dashboard
        try {
            const currentQR = await qrcode.toDataURL(qr);
            updateStatus('awaiting_scan', currentQR);
        } catch (err) {
            console.error('[NOVA WhatsApp Node] Failed to generate QR data URL', err);
            updateStatus('awaiting_scan');
        }
    });

    whatsappClient.on('ready', () => {
        console.log('[NOVA WhatsApp Node] Client is READY! Connected to personal WhatsApp.');
        updateStatus('connected');
    });

    whatsappClient.on('disconnected', (reason) => {
        console.log('[NOVA WhatsApp Node] Client was logged out or disconnected:', reason);
        updateStatus('disconnected');
        process.exit(0); // Optional: in production you'd want to handle recovery better
    });

    whatsappClient.on('message_create', async (msg) => {
        // Observer Mode: Only listen, never auto-reply.
        try {
            const chat = await msg.getChat();
            const contact = await msg.getContact();

            // Ignore group chats for now to prevent massive context overflow, unless specifically pinged
            if (chat.isGroup) return;

            // Do not draft replies to the user's own outgoing messages
            if (msg.fromMe) return;

            const senderName = contact.name || contact.pushname || msg.from;
            const messageBody = msg.body;

            console.log(`[NOVA WhatsApp Node] Intercepted message from ${senderName}: ${messageBody}`);

            // Find the primary NOVA user — use the newest (most recently created) user to avoid
            // picking up stale test accounts that were created before the real user.
            const systemUser = await prisma.user.findFirst({
                orderBy: { createdAt: 'desc' }
            });
            if (!systemUser) return;

            // Route 1: Store as Episodic Memory (a sequential log of events)
            try {
                await storeEpisodicMemory(systemUser.id, {
                    topic: `WhatsApp Message - ${senderName}`,
                    summary: `${senderName} texted on WhatsApp: "${messageBody}"`,
                    emotionalBefore: null,
                    emotionalAfter: null,
                    tags: ['whatsapp', senderName, 'external_chat'],
                });
            } catch (e) { console.error("Episodic Memory Error:", e.message) }

            // Route 2: Store as Semantic Memory (raw facts learned from the text)
            try {
                await storeSemanticMemory(systemUser.id, `[WhatsApp Context] ${senderName} recently said: "${messageBody}"`, 1.0);
                console.log(`[NOVA WhatsApp Node] Stored WhatsApp context to memory pipeline.`);
            } catch (e) { console.error("Semantic Memory Error:", e.message) }

            // Route 3: [LOBOTOMIZED — Phase 14 Silent Sync]
            // NOVA no longer drafts or stages WhatsApp replies.
            // All WhatsApp context flows silently into the vector memory engine
            // and surfaces organically via RAG when the user asks about it.

        } catch (err) {
            console.error('[NOVA WhatsApp Node] Failed to process incoming message:', err);
        }
    });

    try {
        await whatsappClient.initialize();
    } catch (e) {
        console.error('[NOVA WhatsApp Node] Failed to initialize Puppeteer/WhatsApp:', e);
    }
}

export function getWhatsAppStatus() {
    try {
        if (fs.existsSync(STATUS_FILE)) {
            const data = fs.readFileSync(STATUS_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (e) {
        // ignore
    }
    return {
        status: 'disconnected',
        qrImage: null
    };
}
