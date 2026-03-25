import prisma from '@/lib/prisma.js';

export async function GET(request) {
    try {
        const drafts = await prisma.whatsAppDraft.findMany({
            where: {
                status: 'pending'
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        return Response.json({ success: true, drafts });
    } catch (err) {
        console.error('Failed to fetch WhatsApp drafts:', err);
        return Response.json({ success: false, error: err.message }, { status: 500 });
    }
}
