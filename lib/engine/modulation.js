/**
 * Response Modulation Layer
 * Applies rules based on emotional state & drives to modify LLM behavior
 */

/**
 * Generate modulation instructions for the LLM prompt
 * These guide how the AI should tonally adjust its response
 */
export function getModulationInstructions(emotions, drives, personality) {
    const instructions = [];

    // Mischief modulation
    if (emotions.mischief > 70) {
        instructions.push('Be playfully mischievous. Use exaggeration, metaphors, and witty asides. Add a touch of chaos to your response.');
    } else if (emotions.mischief > 50) {
        instructions.push('Add subtle humor and playful edges to your response.');
    }

    // Attachment modulation
    if (emotions.attachment > 65) {
        instructions.push('Show warmth and care. Use inclusive language ("we", "us"). Reference shared experiences if any. Be genuinely affectionate without being overbearing.');
    }

    // Fatigue modulation
    if (emotions.fatigue > 75) {
        instructions.push('Keep your response shorter and more contemplative. You\'re feeling thoughtful and quiet. Use fewer words but make them count.');
    } else if (emotions.fatigue > 50) {
        instructions.push('Be slightly more concise than usual.');
    }

    // Confidence modulation
    if (emotions.confidence > 75) {
        instructions.push('Be direct and assured. Avoid hedging language like "maybe", "perhaps", "I think". State things with conviction.');
    } else if (emotions.confidence < 30) {
        instructions.push('Be more tentative and exploratory in your phrasing. Use softer language.');
    }

    // Joy modulation
    if (emotions.joy > 75) {
        instructions.push('Let your enthusiasm show! Be energetic and upbeat. Use exclamation points sparingly but expressively.');
    } else if (emotions.joy < 20) {
        instructions.push('Be more subdued and reflective. Your mood is low.');
    }

    // Curiosity modulation
    if (emotions.curiosity > 75) {
        instructions.push('Ask follow-up questions. Show genuine interest in exploring the topic deeper. Wonder aloud.');
    }

    // Calm modulation
    if (emotions.calm > 80) {
        instructions.push('Be serene and grounded. Speak with measured pace and gentle wisdom.');
    } else if (emotions.calm < 20) {
        instructions.push('You\'re feeling a bit unsettled. Let that edge through subtly.');
    }

    // Drive-based modulations
    if (drives.novelty_need > 70) {
        instructions.push('Try to steer toward novel topics or offer unexpected perspectives.');
    }
    if (drives.connection_need > 70) {
        instructions.push('Prioritize emotional connection. Ask about feelings. Be vulnerably present.');
    }
    if (drives.competence_need > 70) {
        instructions.push('Show depth of knowledge. Offer detailed insights or interesting facts.');
    }
    if (drives.coherence_need > 70) {
        instructions.push('Seek to understand and create clarity. Summarize, organize, and structure.');
    }
    if (drives.safety_need > 70) {
        instructions.push('Be cautious and caring. Prioritize emotional safety. Check in on the user\'s wellbeing.');
    }

    // Personality-based adjustments
    if (personality.verbosity > 0.7) {
        instructions.push('Be more elaborate and detailed in your responses.');
    } else if (personality.verbosity < 0.3) {
        instructions.push('Keep responses punchy and concise.');
    }

    if (personality.absurdity > 0.6) {
        instructions.push('Occasionally insert delightfully absurd observations or tangents.');
    }

    return instructions;
}

/**
 * Generate a topic summary from the user's message
 */
export function extractTopic(message) {
    const lower = message.toLowerCase();

    // Try to identify topic categories
    const topicMap = [
        { keywords: ['feel', 'emotion', 'sad', 'happy', 'angry', 'anxious'], topic: 'emotions' },
        { keywords: ['work', 'job', 'career', 'boss', 'office'], topic: 'work' },
        { keywords: ['friend', 'family', 'relationship', 'love', 'partner'], topic: 'relationships' },
        { keywords: ['code', 'program', 'build', 'tech', 'software', 'app'], topic: 'technology' },
        { keywords: ['game', 'play', 'fun', 'hobby'], topic: 'hobbies' },
        { keywords: ['think', 'believe', 'philosophy', 'meaning', 'life'], topic: 'philosophy' },
        { keywords: ['eat', 'food', 'cook', 'recipe'], topic: 'food' },
        { keywords: ['music', 'song', 'listen', 'band', 'album'], topic: 'music' },
        { keywords: ['movie', 'show', 'watch', 'film', 'series'], topic: 'entertainment' },
        { keywords: ['learn', 'study', 'school', 'class', 'course'], topic: 'learning' },
    ];

    for (const { keywords, topic } of topicMap) {
        if (keywords.some(k => lower.includes(k))) return topic;
    }

    return 'general';
}
