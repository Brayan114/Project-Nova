import { chromium } from 'playwright';

/**
 * Scrape a webpage and extract readable text content.
 * @param {string} url - The URL to scrape.
 * @returns {Promise<string>} - The extracted text content.
 */
export async function scrapeWebpage(url) {
    let browser;
    try {
        console.log(`[NOVA BROWSER] Launching scraper for: ${url}`);
        browser = await chromium.launch({ headless: true });
        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        });
        const page = await context.newPage();

        // 1. Navigate with timeout
        await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });

        // 2. Extract content
        const isReddit = url.includes('reddit.com');
        
        let scrapedData;
        
        if (isReddit) {
            console.log('[NOVA BROWSER] Detected Reddit. Using specialized selectors...');
            scrapedData = await page.evaluate(() => {
                // Post Title
                const title = document.querySelector('h1')?.innerText || 'No Title';
                
                // Post Body
                // Shreddit uses custom elements, we try to find the main content
                const bodyEl = document.querySelector('div[id$="-post-rtjson-container"]') || 
                               document.querySelector('div[class*="post-content"]') ||
                               document.querySelector('shreddit-post');
                const body = bodyEl?.innerText || '';
                
                // Top Comments (Limit to 3)
                const comments = Array.from(document.querySelectorAll('shreddit-comment'))
                    .slice(0, 3)
                    .map(c => {
                        const author = c.getAttribute('author') || 'unknown';
                        const text = c.querySelector('div[id$="-comment-rtjson-container"]')?.innerText || '';
                        return `${author}: ${text}`;
                    })
                    .filter(t => t.length > 5);

                return {
                    title,
                    body,
                    comments
                };
            });

            return `[REDDIT POST: ${scrapedData.title}]\n\n${scrapedData.body}\n\n--- TOP COMMENTS ---\n${scrapedData.comments.join('\n\n')}`;
        }

        // Default generic scraper
        const text = await page.evaluate(() => {
            const stripSelectors = ['nav', 'footer', 'script', 'style', 'header', 'aside', '.ads', '#ads'];
            stripSelectors.forEach(selector => {
                document.querySelectorAll(selector).forEach(el => el.remove());
            });

            // Extract text from the remaining content
            return document.body.innerText
                .split('\n')
                .map(line => line.trim())
                .filter(line => line.length > 20) // Filter out short snippets/menu items
                .join('\n');
        });

        console.log(`[NOVA BROWSER] Successfully scraped ${text.length} characters.`);
        return text;

    } catch (error) {
        console.error('[NOVA BROWSER] Scraping failed:', error.message);
        throw error;
    } finally {
        if (browser) await browser.close();
    }
}
