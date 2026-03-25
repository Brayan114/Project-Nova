import prisma from '../prisma.js';
import { DEFAULT_TRAITS } from './personality.js';
import { DEFAULT_EMOTIONS, DEFAULT_DRIVES } from './emotions.js';

/**
 * Multi-Agent Sandbox System
 * Allows multiple AI companions to interact, evolve, and influence personality
 */

/**
 * Create a sandbox agent for a user
 */
export async function createSandboxAgent(userId, name, personalityOverrides = {}) {
    const personality = { ...DEFAULT_TRAITS, ...personalityOverrides };
    const emotions = { ...DEFAULT_EMOTIONS };
    const drives = { ...DEFAULT_DRIVES };

    return prisma.sandboxAgent.create({
        data: {
            userId,
            name,
            personality: JSON.stringify(personality),
            emotions: JSON.stringify(emotions),
            drives: JSON.stringify(drives),
        },
    });
}

/**
 * Get all sandbox agents for a user
 */
export async function getSandboxAgents(userId) {
    const agents = await prisma.sandboxAgent.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
    });

    return agents.map(a => ({
        id: a.id,
        name: a.name,
        personality: JSON.parse(a.personality),
        emotions: JSON.parse(a.emotions),
        drives: JSON.parse(a.drives),
        createdAt: a.createdAt,
    }));
}

/**
 * Run a sandbox simulation where agents interact with each other
 * Returns simulation log and results
 */
export async function runSandboxSimulation(userId, rounds = 3) {
    const agents = await getSandboxAgents(userId);

    if (agents.length < 2) {
        return {
            success: false,
            error: 'Need at least 2 agents for simulation',
            log: [],
        };
    }

    const log = [];
    const topics = [
        'What makes a good companion?',
        'How do you handle disagreements?',
        'What\'s the most interesting thing you\'ve learned?',
        'How do emotions shape decisions?',
        'What does trust mean to you?',
        'How do you balance honesty and kindness?',
    ];

    for (let round = 0; round < rounds; round++) {
        const topic = topics[round % topics.length];
        const speaker = agents[round % agents.length];
        const listener = agents[(round + 1) % agents.length];

        // Simulate interaction
        const interaction = simulateInteraction(speaker, listener, topic);
        log.push({
            round: round + 1,
            speaker: speaker.name,
            listener: listener.name,
            topic,
            exchange: interaction.exchange,
            emotionalShift: interaction.emotionalShift,
        });

        // Apply emotional effects
        await applyAgentEmotionalShift(speaker.id, interaction.speakerShift);
        await applyAgentEmotionalShift(listener.id, interaction.listenerShift);
    }

    return {
        success: true,
        rounds,
        agentCount: agents.length,
        log,
    };
}

/**
 * Simulate a single interaction between two agents
 */
function simulateInteraction(speaker, listener, topic) {
    const speakerTraits = speaker.personality;
    const listenerTraits = listener.personality;

    // Generate interaction quality based on personality compatibility
    const empathyMatch = 1 - Math.abs(speakerTraits.empathy - listenerTraits.empathy);
    const curiosityMatch = (speakerTraits.curiosity + listenerTraits.curiosity) / 2;
    const conflictRisk = Math.abs(speakerTraits.confidence - listenerTraits.confidence) * 0.3;

    const interactionQuality = (empathyMatch * 0.4 + curiosityMatch * 0.3 - conflictRisk) * 100;

    const exchange = `${speaker.name} discusses "${topic}" with ${listener.name}. ` +
        (interactionQuality > 60
            ? 'They find common ground and build on each other\'s ideas.'
            : interactionQuality > 30
                ? 'They explore different perspectives with mild tension.'
                : 'They struggle to connect on this topic.');

    const speakerShift = {
        joy: interactionQuality > 50 ? 5 : -3,
        curiosity: curiosityMatch > 0.5 ? 8 : 2,
        confidence: interactionQuality > 40 ? 3 : -2,
        calm: conflictRisk < 0.2 ? 5 : -5,
        attachment: interactionQuality > 60 ? 4 : 0,
    };

    const listenerShift = {
        joy: interactionQuality > 50 ? 4 : -2,
        curiosity: curiosityMatch > 0.5 ? 6 : 3,
        confidence: interactionQuality > 40 ? 2 : -1,
        calm: conflictRisk < 0.2 ? 4 : -3,
        attachment: interactionQuality > 60 ? 3 : 0,
    };

    return {
        exchange,
        emotionalShift: interactionQuality,
        speakerShift,
        listenerShift,
    };
}

/**
 * Apply emotional shift to a sandbox agent
 */
async function applyAgentEmotionalShift(agentId, shift) {
    const agent = await prisma.sandboxAgent.findUnique({ where: { id: agentId } });
    if (!agent) return;

    const emotions = JSON.parse(agent.emotions);

    for (const [key, delta] of Object.entries(shift)) {
        if (emotions[key] !== undefined) {
            emotions[key] = Math.max(0, Math.min(100, emotions[key] + delta));
        }
    }

    await prisma.sandboxAgent.update({
        where: { id: agentId },
        data: { emotions: JSON.stringify(emotions) },
    });
}
