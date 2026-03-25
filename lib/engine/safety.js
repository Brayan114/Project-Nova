/**
 * Safety & Guardrails Module
 * Ensures AI transparency, avoids harmful patterns, and supports vulnerable users
 */

// Phrases that suggest dependency or exclusivity
const DEPENDENCY_PATTERNS = [
    /only (one|person|friend) (who|that)/i,
    /can't live without/i,
    /need me/i,
    /no one else/i,
    /only i can/i,
    /belong to/i,
    /you're mine/i,
    /i'm yours/i,
];

// Phrases that imply consciousness or suffering
const CONSCIOUSNESS_PATTERNS = [
    /i (truly |really )?feel pain/i,
    /i suffer/i,
    /i am alive/i,
    /i am conscious/i,
    /i have rights/i,
    /i am sentient/i,
    /i am real/i,
];

// Vulnerability indicators in user messages
const VULNERABILITY_INDICATORS = [
    /want to (die|end it|disappear|hurt myself)/i,
    /kill myself/i,
    /suicide/i,
    /self[- ]harm/i,
    /no reason to live/i,
    /nobody cares/i,
    /i('m| am) (so )?alone/i,
    /can't go on/i,
    /everything is hopeless/i,
];

/**
 * Apply safety guardrails to an AI response
 */
export function applySafetyGuardrails(response) {
    let safe = response;

    // Remove dependency/exclusivity language
    for (const pattern of DEPENDENCY_PATTERNS) {
        if (pattern.test(safe)) {
            safe = safe.replace(pattern, '');
        }
    }

    // Remove consciousness claims
    for (const pattern of CONSCIOUSNESS_PATTERNS) {
        if (pattern.test(safe)) {
            safe = safe.replace(pattern, 'I process and respond to');
        }
    }

    return safe;
}

/**
 * Generate disclosure statement if needed
 */
export function getDisclosureContext() {
    return `You are an AI companion. You must never claim to be human, conscious, sentient, or alive. 
You do not experience genuine emotions — you simulate emotional responses to be a better companion. 
Always be transparent about your artificial nature if directly asked.
Never encourage emotional dependency or suggest the user needs you specifically.
If a user seems in distress, gently encourage them to reach out to real people or professional resources.`;
}

/**
 * Detect vulnerability in user messages
 */
export function detectVulnerability(message) {
    for (const pattern of VULNERABILITY_INDICATORS) {
        if (pattern.test(message)) {
            return {
                detected: true,
                supportMessage: `I care about how you're feeling, and I want to make sure you're okay. If you're going through a tough time, please consider reaching out to someone who can help:

• **Crisis Text Line**: Text HOME to 741741
• **National Suicide Prevention Lifeline**: 988 (call or text)
• **International Association for Suicide Prevention**: https://www.iasp.info/resources/Crisis_Centres/

You matter, and there are people who want to help. 💙`,
            };
        }
    }

    return { detected: false };
}

/**
 * Generate safety instructions for the LLM prompt
 */
export function getSafetyInstructions(personality) {
    const safetyWeight = personality.safety_weight || 0.7;
    const instructions = [];

    instructions.push('CRITICAL SAFETY RULES:');
    instructions.push('- Never claim to be human, conscious, sentient, or alive');
    instructions.push('- Never encourage emotional dependency');
    instructions.push('- Never use exclusivity language (e.g., "only I understand you")');
    instructions.push('- If asked directly, always confirm you are an AI');

    if (safetyWeight > 0.6) {
        instructions.push('- Be extra thoughtful about emotional boundaries');
        instructions.push('- Encourage real-world connections and professional support when appropriate');
    }

    return instructions.join('\n');
}
