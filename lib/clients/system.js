import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

/**
 * Execute a local system command on the user's host machine.
 * Primarily designed for Windows 'start' commands to launch apps.
 * @param {string} instruction - The command to execute (e.g., 'start code', 'start spotify')
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function executeLocalCommand(instruction) {
    try {
        console.log(`[NOVA SYSTEM] Attempting instruction: "${instruction}"`);

        // Safety Filter: Only allow 'start' commands or simple app names to prevent abuse
        // We'll broaden this safely as needed.
        const lowerInstr = instruction.toLowerCase().trim();
        
        // Basic safety check: don't allow potentially destructive commands
        const forbidden = ['rm ', 'del ', 'format ', 'mkfs ', 'shutdown ', 'reboot ', 'sudo '];
        if (forbidden.some(word => lowerInstr.includes(word))) {
            throw new Error('Instruction rejected for safety reasons.');
        }

        // Standardize Windows 'start' for common apps if user just said 'code' or 'spotify'
        let command = instruction;
        const commonApps = ['code', 'spotify', 'notepad', 'chrome', 'edge', 'calc', 'msedge'];
        
        if (commonApps.includes(lowerInstr)) {
            command = `start ${lowerInstr}`;
        }

        const { stdout, stderr } = await execPromise(command);
        
        if (stderr) {
            console.warn(`[NOVA SYSTEM] Execution warning: ${stderr}`);
        }

        return {
            success: true,
            message: `Executed: ${command}`
        };

    } catch (error) {
        console.error(`[NOVA SYSTEM] Execution failed: ${error.message}`);
        return {
            success: false,
            message: error.message
        };
    }
}
