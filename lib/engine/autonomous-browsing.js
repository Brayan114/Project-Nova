import { getRecentTopics, storeSemanticMemory } from './memory.js';
import { generateResponse } from '../llm/provider.js';
import { findRedditLink } from './search.js';
import { scrapeWebpage } from '../clients/browser.js';
import prisma from '../prisma.js';

/**
 * Autonomous Browsing Engine:
 * 1. Reads user's recent topics.
 * 2. Asks LLM for a search query.
 * 3. Finds a relevant Reddit thread.
 * 4. Scrapes and remembers it.
 */
export async function runAutonomousBrowsing(userId) {
    try {
        console.log(`[NOVA AUTONOMOUS] Starting session for ${userId}...`);

        // 1. Fetch user interest topics
        const topics = await getRecentTopics(userId, 5);
        if (topics.length === 0) {
            console.log('[NOVA AUTONOMOUS] No specific topics found. Falling back to general interests.');
            topics.push('tech news', 'gaming', 'future of AI');
        }

        const topicsStr = topics.join(', ');
        
        // 2. Generate Search Query via LLM
        // We request JSON because provider.js expects a JSON structure with a 'message' field
        const systemPrompt = `You are NOVA's curiosity engine. Based on the user's recent topics: [${topicsStr}], generate a single, highly specific search query to find an interesting Reddit thread they would care about. 
        Output ONLY a JSON object: {"expression": "thinking", "message": "query string"}. 
        Example query: "Alexander the Great mosaic discovery" or "elden ring dlc difficulty". 
        DO NOT include "reddit" or "site:" in the query string itself. No small talk.`;
        
        const llmResult = await generateResponse(systemPrompt, `Identify a topic the user cares about from this list: ${topicsStr}`, [], true);
        const query = llmResult.content.replace(/["']/g, '').trim();

        console.log(`[NOVA AUTONOMOUS] LLM generated query: "${query}"`);

        // 3. Find Reddit Link
        const redditLink = await findRedditLink(query);
        if (!redditLink) {
            console.warn(`[NOVA AUTONOMOUS] No Reddit thread found for query: ${query}`);
            return;
        }

        console.log(`[NOVA AUTONOMOUS] Found Reddit thread: ${redditLink}`);

        // 4. Scrape the page
        const content = await scrapeWebpage(redditLink);
        if (!content || content.length < 100) {
            console.warn('[NOVA AUTONOMOUS] Scraped content was empty or too thin.');
            return;
        }

        // 5. Ingest into SemanticMemory
        // Limit to 4000 chars for vector safety
        const fact = `[Social Media Scrape: ${redditLink}] ${content.substring(0, 4000)}`;
        await storeSemanticMemory(userId, fact, 0.7, ['social_media_scrape']);

        console.log(`[NOVA AUTONOMOUS] Memory ingested successfully for: "${query}"`);

    } catch (error) {
        console.error('[NOVA AUTONOMOUS] Task failed:', error.message);
    }
}
