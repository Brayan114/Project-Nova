import prisma from '../prisma.js';

// Default personality traits (0-1 scale)
export const DEFAULT_TRAITS = {
    empathy: 0.7,
    mischief: 0.4,
    confidence: 0.6,
    curiosity: 0.8,
    warmth: 0.7,
    absurdity: 0.3,
    verbosity: 0.5,
    initiative_bias: 0.4,
    safety_weight: 0.7,
    emotional_amplitude: 0.6,
    emotional_decay: 0.05,
    humor_style: 0.5, // 0 = dry, 1 = absurd
};

/**
 * Get the current personality snapshot for a user
 */
export async function getPersonalitySnapshot(userId) {
    const state = await prisma.personalityState.findUnique({
        where: { userId },
    });

    if (!state) return { ...DEFAULT_TRAITS };
    return JSON.parse(state.traits);
}

/**
 * Initialize personality state for a new user
 */
export async function initializePersonality(userId, overrides = {}) {
    const traits = { ...DEFAULT_TRAITS, ...overrides };
    return prisma.personalityState.create({
        data: {
            userId,
            traits: JSON.stringify(traits),
        },
    });
}

/**
 * Drift personality traits slowly based on interaction data
 * Called after each interaction — very small drift values
 */
export async function driftPersonality(userId, interactionData) {
    const current = await getPersonalitySnapshot(userId);
    const driftRate = 0.002; // Very slow drift

    // Positive/warm interactions increase empathy and warmth
    if (interactionData.sentiment > 0.5) {
        current.empathy = clamp(current.empathy + driftRate);
        current.warmth = clamp(current.warmth + driftRate * 0.5);
    }

    // Humorous interactions increase mischief
    if (interactionData.humor > 0.5) {
        current.mischief = clamp(current.mischief + driftRate);
        current.absurdity = clamp(current.absurdity + driftRate * 0.5);
    }

    // Deep/curious interactions increase curiosity
    if (interactionData.depth > 0.5) {
        current.curiosity = clamp(current.curiosity + driftRate);
    }

    // Conflict interactions increase safety_weight, decrease confidence slightly
    if (interactionData.conflict > 0.5) {
        current.safety_weight = clamp(current.safety_weight + driftRate);
        current.confidence = clamp(current.confidence - driftRate * 0.5);
    }

    await prisma.personalityState.update({
        where: { userId },
        data: {
            traits: JSON.stringify(current),
            lastDriftUpdate: new Date(),
        },
    });

    return current;
}

function clamp(value, min = 0, max = 1) {
    return Math.max(min, Math.min(max, value));
}
