import { NextResponse } from 'next/server';
import { scrapeWebpage } from '@/lib/clients/browser';
import { generateEmbedding, storeSemanticMemory } from '@/lib/engine/memory';
import prisma from '@/lib/prisma';

export async function POST(request) {
    try {
        const { url, userId } = await request.json();

        if (!url || !userId) {
            return NextResponse.json({ error: 'url and userId are required' }, { status: 400 });
        }

        // 1. Verify user
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // 2. Scrape the page
        const content = await scrapeWebpage(url);
        if (!content || content.length < 50) {
            return NextResponse.json({ error: 'Scraped content too thin or empty' }, { status: 400 });
        }

        // 3. Chunk and Ingest
        // For now, we take the top chunk (first 2000 chars) to stay within embedding limits or refine later
        const chunk = content.substring(0, 3000);
        const fact = `[Web Scrape: ${url}] ${chunk}`;

        // 4. Generate Embedding and Store in SemanticMemory
        // storeSemanticMemory handles the generateEmbedding + pgvector logic internally
        const memory = await storeSemanticMemory(userId, fact, 0.8);

        return NextResponse.json({
            success: true,
            url,
            memoryId: memory.id,
            charCount: content.length,
            preview: content.substring(0, 200) + '...'
        });

    } catch (error) {
        console.error('[SCRAPE API ERROR]', error);
        return NextResponse.json({ 
            success: false, 
            error: error.message || 'Scraping/Ingestion failed' 
        }, { status: 500 });
    }
}
