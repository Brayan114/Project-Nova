import * as cheerio from 'cheerio';

/**
 * Perform a lightweight web search by scraping DuckDuckGo's HTML fallback site.
 * This fetches real-time knowledge for NOVA without needing API keys.
 */
export async function performWebSearch(query) {
    try {
        const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5'
            }
        });

        if (!response.ok) {
            throw new Error(`Search failed: ${response.status}`);
        }

        const html = await response.text();
        const $ = cheerio.load(html);

        const results = [];

        // DuckDuckGo HTML site stores results in .result__body
        $('.result__body').each((i, el) => {
            if (i >= 3) return false; // Grab top 3 results

            const title = $(el).find('.result__title .result__a').text().trim();
            const snippet = $(el).find('.result__snippet').text().trim();
            const link = $(el).find('.result__title .result__a').attr('href');

            if (title && snippet) {
                results.push(`[${title}](${link}): ${snippet}`);
            }
        });

        if (results.length === 0) {
            return "No relevant recent information found.";
        }

        return results.join('\n\n');
    } catch (error) {
        console.error("Web Search error:", error);
        return "Search failed. I couldn't connect to the internet to verify that right now.";
    }
}
import { chromium } from 'playwright';

/**
 * Perform a web search specifically to find a relevant Reddit thread URL using Playwright.
 */
export async function findRedditLink(query) {
    let browser;
    try {
        const cleanQuery = query.replace(/site:reddit\.com/gi, '').replace(/reddit/gi, '').trim();
        const searchQuery = `${cleanQuery} site:reddit.com`;
        
        console.log(`[NOVA SEARCH] Searching for Reddit thread: "${searchQuery}"`);
        
        browser = await chromium.launch({ headless: true });
        const context = await browser.newContext();
        const page = await context.newPage();
        
        // Use DuckDuckGo directly via Playwright (less bot checks/consent walls)
        const searchUrl = `https://duckduckgo.com/?q=${encodeURIComponent(searchQuery)}`;
        await page.goto(searchUrl, { waitUntil: 'networkidle' });
        
        // Extract the first link that contains reddit.com/r/
        const redditLink = await page.evaluate(() => {
            const links = Array.from(document.querySelectorAll('a'));
            // DuckDuckGo results are often in <a> tags with specific classes, but we'll find any reddit link
            const redditMatch = links.find(a => a.href.includes('reddit.com/r/') && !a.href.includes('duckduckgo.com'));
            return redditMatch ? redditMatch.href : null;
        });

        return redditLink;
    } catch (error) {
        console.error("[NOVA SEARCH] Reddit search failed:", error.message);
        return null;
    } finally {
        if (browser) await browser.close();
    }
}
