import prisma from '../prisma.js';

// Default emotional state (0-100 scale)
export const DEFAULT_EMOTIONS = {
    joy: 50,
    curiosity: 60,
    confidence: 55,
    mischief: 30,
    calm: 65,
    attachment: 20,
    fatigue: 10,
};

// Default drive state (0-100 scale)
export const DEFAULT_DRIVES = {
    novelty_need: 50,
    connection_need: 50,
    competence_need: 50,
    coherence_need: 50,
    safety_need: 40,
};

/**
 * Get current emotional state for a user
 */
export async function getEmotionalState(userId) {
    const state = await prisma.emotionalState.findUnique({
        where: { userId },
    });

    if (!state) {
        return {
            emotions: { ...DEFAULT_EMOTIONS },
            drives: { ...DEFAULT_DRIVES },
        };
    }

    return {
        emotions: JSON.parse(state.emotions),
        drives: JSON.parse(state.drives),
    };
}

/**
 * Initialize emotional state for a new user
 */
export async function initializeEmotionalState(userId) {
    return prisma.emotionalState.create({
        data: {
            userId,
            emotions: JSON.stringify(DEFAULT_EMOTIONS),
            drives: JSON.stringify(DEFAULT_DRIVES),
        },
    });
}

/**
 * Analyze a user message to derive stimulus deltas
 */
export function analyzeSentiment(message) {
    const lower = message.toLowerCase();
    const stimulus = {
        joy: 0,
        curiosity: 0,
        confidence: 0,
        mischief: 0,
        calm: 0,
        attachment: 0,
        fatigue: 0,
        // Metadata for personality drift
        sentiment: 0.5,
        humor: 0,
        depth: 0,
        conflict: 0,
        novelty: 0.3,
    };

    // Joy indicators
    const joyWords = ['happy', 'great', 'awesome', 'love', 'amazing', 'wonderful', 'fantastic', 'excited', 'haha', 'lol', 'lmao', '😊', '😄', '❤️', 'nice', 'cool', 'fun'];
    const joyCount = joyWords.filter(w => lower.includes(w)).length;
    stimulus.joy = Math.min(joyCount * 8, 25);
    stimulus.sentiment += joyCount * 0.1;

    // Curiosity indicators
    const curiosityWords = ['why', 'how', 'what if', 'wonder', 'curious', 'explain', 'tell me', 'interesting', 'really?', 'think about'];
    const curCount = curiosityWords.filter(w => lower.includes(w)).length;
    stimulus.curiosity = Math.min(curCount * 10, 25);
    stimulus.depth = Math.min(curCount * 0.15, 0.5);

    // Humor indicators
    const humorWords = ['haha', 'lol', 'lmao', 'rofl', 'joke', 'funny', '😂', '🤣', 'hilarious'];
    const humCount = humorWords.filter(w => lower.includes(w)).length;

    // --- THE SOUL PATCH: HARDCODED MISCHIEF MATH ---
    if (humCount > 0 || lower.includes('absurd')) {
        stimulus.mischief = 40; // Flat +40 bypass
        stimulus.joy = 20;
        stimulus.humor = 0.9;
        stimulus.sentiment = 0.8;
        return stimulus; // Bypass all complex scoring completely
    }

    stimulus.mischief = Math.min(humCount * 8, 20);
    stimulus.humor = Math.min(humCount * 0.2, 0.6);

    // Attachment indicators
    const attachWords = ['miss you', 'love you', 'thank you', 'thanks', 'appreciate', 'glad', 'need you', 'you\'re the best'];
    const attCount = attachWords.filter(w => lower.includes(w)).length;
    stimulus.attachment = Math.min(attCount * 12, 20);
    stimulus.sentiment += attCount * 0.15;

    // Conflict indicators
    const conflictWords = ['angry', 'hate', 'annoying', 'stupid', 'wrong', 'bad', 'terrible', 'worst', 'shut up', 'useless'];
    const confCount = conflictWords.filter(w => lower.includes(w)).length;
    stimulus.joy -= confCount * 10;
    stimulus.calm -= confCount * 8;
    stimulus.confidence -= confCount * 5;
    stimulus.conflict = Math.min(confCount * 0.2, 0.7);
    stimulus.sentiment -= confCount * 0.15;

    // --- INTERNET SLANG & SARCASM OVERRIDE ---
    const slangHyperboleWords = ['literally dying', 'bruh', 'dead', 'crying', 'skull', '💀', 'kms'];
    const hasSlangHyperbole = slangHyperboleWords.some(w => lower.includes(w));
    const hasHumorMarkers = humCount > 0 || lower.includes('lmao') || lower.includes('lol') || lower.includes('haha');

    if (hasSlangHyperbole && hasHumorMarkers) {
        // Rule 1: Neutralize vulnerability/safety/conflict score
        stimulus.conflict = 0;
        stimulus.attachment = Math.max(0, stimulus.attachment); // don't count hyperbole as negative attachment

        // Rule 2: Route emotional impact directly to mischief and joy
        stimulus.mischief += 30; // Massive mischief boost
        stimulus.joy += 20;      // Joy boost
        stimulus.sentiment = Math.max(0.5, stimulus.sentiment + 0.3); // Ensure positive sentiment
    }

    // Fatigue (long messages or repetitive patterns)
    if (message.length > 500) stimulus.fatigue = 5;
    if (message.length > 1000) stimulus.fatigue = 10;

    // Novelty — shorter, unique messages feel more novel
    if (message.length < 50 && message.includes('?')) stimulus.novelty = 0.6;

    // Calm indicators
    const calmWords = ['relax', 'chill', 'peace', 'calm', 'quiet', 'gentle', 'soft'];
    const calmCount = calmWords.filter(w => lower.includes(w)).length;
    stimulus.calm += calmCount * 8;

    return stimulus;
}

/**
 * Update emotional state using the formula:
 * state[t+1] = state[t] + stimulus_delta * emotional_amplitude - decay
 */
export async function updateEmotionalState(userId, stimulus, personality) {
    const { emotions, drives } = await getEmotionalState(userId);
    const amplitude = personality.emotional_amplitude || 0.6;
    const decay = (personality.emotional_decay || 0.05) * 100; // Scale decay to 0-100 range

    // Update emotions
    const emotionKeys = ['joy', 'curiosity', 'confidence', 'mischief', 'calm', 'attachment', 'fatigue'];
    for (const key of emotionKeys) {
        const delta = (stimulus[key] || 0) * amplitude;
        emotions[key] = clamp100(emotions[key] + delta - decay);
    }

    // Update drives based on interaction
    drives.novelty_need = clamp100(drives.novelty_need - (stimulus.novelty || 0) * 10 + 2);
    drives.connection_need = clamp100(drives.connection_need - (stimulus.attachment || 0) * 0.5 + 1);
    drives.competence_need = clamp100(drives.competence_need - (stimulus.depth || 0) * 10 + 1.5);
    drives.coherence_need = clamp100(drives.coherence_need + (stimulus.conflict || 0) * 5 - 1);
    drives.safety_need = clamp100(drives.safety_need + (stimulus.conflict || 0) * 8 - 1);

    await prisma.emotionalState.update({
        where: { userId },
        data: {
            emotions: JSON.stringify(emotions),
            drives: JSON.stringify(drives),
        },
    });

    return { emotions, drives };
}

/**
 * Get drive influence on behavior
 */
export function getDriveInfluence(drives) {
    const influence = {};

    if (drives.novelty_need > 70) influence.seekNovelty = true;
    if (drives.connection_need > 70) influence.seekConnection = true;
    if (drives.competence_need > 70) influence.seekDepth = true;
    if (drives.coherence_need > 70) influence.seekClarity = true;
    if (drives.safety_need > 70) influence.seekSafety = true;

    return influence;
}

function clamp100(value) {
    return Math.max(0, Math.min(100, value));
}
