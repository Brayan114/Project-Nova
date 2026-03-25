import { NextResponse } from 'next/server';
import { getWhatsAppStatus, initWhatsAppClient } from '@/lib/clients/whatsapp';

export async function GET() {
    try {
        const { status, qrImage } = getWhatsAppStatus();

        // If it's disconnected and not initializing, try to kickstart it
        if (status === 'disconnected') {
            initWhatsAppClient().catch(console.error);
        }

        return NextResponse.json({ success: true, status, qrImage });
    } catch (error) {
        return NextResponse.json({ success: false, error: 'Failed to fetch WhatsApp status' }, { status: 500 });
    }
}
