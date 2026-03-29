import screenshot from 'screenshot-desktop';
import sharp from 'sharp';

/**
 * Capture a screenshot of the primary monitor.
 * Returns a Gemini-compatible multimodal object (base64 string).
 * Lightweight version: Resizes and compresses to JPEG to save tokens/quota.
 * @returns {Promise<{inlineData: {data: string, mimeType: string}}>}
 */
export async function captureScreen() {
    try {
        console.log('[NOVA VISION] Capturing primary monitor...');
        
        // 1. Capture screenshot as a raw buffer (PNG default)
        const rawBuffer = await screenshot({ format: 'png' });
        
        // 2. Process with Sharp to lighten the load
        // Max width of 1024px keeps detail but slashes pixel count
        console.log(`[NOVA VISION] Compressing capture (Raw: ${(rawBuffer.length / 1024).toFixed(1)} KB)...`);
        
        const processedBuffer = await sharp(rawBuffer)
            .resize({ width: 1024, withoutEnlargement: true })
            .jpeg({ quality: 75, progressive: true })
            .toBuffer();
        
        // 3. Convert buffer to base64 string
        const base64Image = processedBuffer.toString('base64');
        
        console.log(`[NOVA VISION] Compression successful! (Lighter: ${(processedBuffer.length / 1024).toFixed(1)} KB)`);
        
        return {
            inlineData: {
                data: base64Image,
                mimeType: "image/jpeg"
            }
        };
    } catch (error) {
        console.error('[NOVA VISION] Capture failed:', error);
        throw new Error('Failed to capture screen: ' + error.message);
    }
}
