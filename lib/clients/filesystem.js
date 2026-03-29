import fs from 'fs/promises';
import path from 'path';

const WORKSPACE_DIR = 'nova_workspace';

/**
 * Ensures the workspace directory exists.
 */
async function ensureWorkspace() {
    const fullPath = path.resolve(process.cwd(), WORKSPACE_DIR);
    try {
        await fs.access(fullPath);
    } catch {
        console.log(`[NOVA FS] Creating workspace: ${fullPath}`);
        await fs.mkdir(fullPath, { recursive: true });
    }
    return fullPath;
}

/**
 * Resolves a file path, jailing it to the workspace unless it's absolute.
 * @param {string} filePath - The path to resolve.
 * @returns {Promise<string>} - The absolute path.
 */
async function resolveSafePath(filePath) {
    const workspace = await ensureWorkspace();
    
    // If the path is absolute, trust it (as per user request)
    if (path.isAbsolute(filePath)) {
        return filePath;
    }
    
    // Otherwise, jail it to the workspace
    return path.join(workspace, path.basename(filePath));
}

/**
 * Read the content of a local file.
 * @param {string} filePath - Path to the file.
 * @returns {Promise<string>}
 */
export async function readLocalFile(filePath) {
    try {
        const safePath = await resolveSafePath(filePath);
        console.log(`[NOVA FS] Reading file: ${safePath}`);
        return await fs.readFile(safePath, 'utf-8');
    } catch (error) {
        console.error(`[NOVA FS] Read error: ${error.message}`);
        throw new Error(`Failed to read file: ${error.message}`);
    }
}

/**
 * Write or overwrite a file with content.
 * @param {string} filePath - Path to the file.
 * @param {string} content - Text content to write.
 * @returns {Promise<{success: boolean, path: string}>}
 */
export async function writeLocalFile(filePath, content) {
    try {
        const safePath = await resolveSafePath(filePath);
        console.log(`[NOVA FS] Writing file: ${safePath}`);
        
        // Ensure parent directory exists if user provided an absolute path with subfolders
        const parentDir = path.dirname(safePath);
        await fs.mkdir(parentDir, { recursive: true });

        await fs.writeFile(safePath, content, 'utf-8');
        
        return {
            success: true,
            path: safePath,
            message: `Successfully wrote ${content.length} characters to ${path.basename(safePath)}`
        };
    } catch (error) {
        console.error(`[NOVA FS] Write error: ${error.message}`);
        throw new Error(`Failed to write file: ${error.message}`);
    }
}
