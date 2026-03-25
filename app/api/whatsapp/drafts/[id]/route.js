import prisma from '@/lib/prisma.js';
import { getWhatsAppStatus } from '@/lib/clients/whatsapp.js';

export async function POST(request, { params }) {
    const resolvedParams = await params;
    const { id } = resolvedParams;

    try {
        const body = await request.json();
        const action = body.action; // "approve" or "reject"

        const draft = await prisma.whatsAppDraft.findUnique({
            where: { id }
        });

        if (!draft) {
            return Response.json({ success: false, error: 'Draft not found' }, { status: 404 });
        }

        if (action === 'approve') {
            // Send the message via whatsapp-web.js
            const client = global.whatsappClient;
            const { status } = getWhatsAppStatus();

            if (!client || status !== 'connected') {
                return Response.json({ success: false, error: 'WhatsApp client is not connected' }, { status: 500 });
            }

            // To reply, we need the chat ID. In whatsapp-web.js, getting a chat by name is tricky when using pushnames
            const contacts = await client.getContacts();
            let targetChatId = null;

            const targetContact = contacts.find(c => c.name === draft.contact || c.pushname === draft.contact);

            if (targetContact) {
                targetChatId = targetContact.id._serialized;
            } else {
                // Fallback to chats
                const chats = await client.getChats();
                const targetChat = chats.find(c => c.name === draft.contact || String(c.id._serialized) === draft.contact);
                if (targetChat) targetChatId = targetChat.id._serialized;
            }

            if (!targetChatId) {
                return Response.json({ success: false, error: 'Could not find chat for ' + draft.contact }, { status: 500 });
            }

            await client.sendMessage(targetChatId, draft.draft);

            // Mark as approved
            await prisma.whatsAppDraft.update({
                where: { id },
                data: { status: 'approved' }
            });

            return Response.json({ success: true, message: 'Message sent and draft approved' });
        } else if (action === 'reject') {
            // Mark as rejected
            await prisma.whatsAppDraft.update({
                where: { id },
                data: { status: 'rejected' }
            });
            return Response.json({ success: true, message: 'Draft rejected' });
        } else {
            return Response.json({ success: false, error: 'Invalid action' }, { status: 400 });
        }

    } catch (err) {
        console.error('Failed to update WhatsApp draft:', err);
        return Response.json({ success: false, error: err.message }, { status: 500 });
    }
}
