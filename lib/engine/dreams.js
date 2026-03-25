import prisma from '../prisma.js';
import { getPersonalitySnapshot, driftPersonality } from './personality.js';
import { getEmotionalState } from './emotions.js';

/**
 * Dream Mode Simulation
 * Background mode where agents replay memories and interact,
 * causing slow personality adjustment
 */

/**
 * Run a dream mode cycle for a user
 * - Replays high-importance memories
 * - Simulates internal processing
 * - Adjusts personality traits based on dream outcomes
 */
export async function runDreamMode(userId) {
    const personality = await getPersonalitySnapshot(userId);
    const { emotions, drives } = await getEmotionalState(userId);

    // Get high-importance memories to "dream about"
    const memories = await prisma.episodicMemory.findMany({
        where: { userId },
        orderBy: { importanceScore: 'desc' },
        take: 5,
    });

    if (memories.length === 0) {
        return {
            success: false,
            reason: 'No memories to dream about yet',
            adjustments: {},
        };
    }

    const dreamLog = [];
    const adjustments = {};

    for (const memory of memories) {
        const emotionalAfter = JSON.parse(memory.emotionalAfter);
        const emotionalBefore = JSON.parse(memory.emotionalBefore);

        // Analyze the emotional arc of this memory
        const emotionalDelta = {};
        for (const key of Object.keys(emotionalAfter)) {
            emotionalDelta[key] = (emotionalAfter[key] || 0) - (emotionalBefore[key] || 0);
        }

        // Dream processing: reinforce positive arcs, process negative ones
        const dreamResult = processDream(memory, emotionalDelta, personality);
        dreamLog.push({
            topic: memory.topic,
            summary: memory.summary,
            processing: dreamResult.processing,
            traitAdjustment: dreamResult.adjustment,
        });

        // Accumulate adjustments
        for (const [trait, delta] of Object.entries(dreamResult.adjustment)) {
            adjustments[trait] = (adjustments[trait] || 0) + delta;
        }
    }

    // Apply dream drift to personality (very small adjustments)
    if (Object.keys(adjustments).length > 0) {
        await applyDreamDrift(userId, adjustments);
    }

    return {
        success: true,
        memoriesProcessed: memories.length,
        dreamLog,
        adjustments,
    };
}

/**
 * Process a single memory in dream mode
 */
function processDream(memory, emotionalDelta, personality) {
    const driftRate = 0.001; // Even slower than normal drift
    const adjustment = {};

    // Joy-heavy memories reinforce warmth
    if ((emotionalDelta.joy || 0) > 10) {
        adjustment.warmth = driftRate;
        adjustment.empathy = driftRate * 0.5;
    }

    // Curiosity-heavy memories reinforce curiosity
    if ((emotionalDelta.curiosity || 0) > 10) {
        adjustment.curiosity = driftRate;
    }

    // Mischief-heavy memories reinforce humor
    if ((emotionalDelta.mischief || 0) > 10) {
        adjustment.mischief = driftRate * 0.5;
        adjustment.humor_style = driftRate;
    }

    // High-attachment memories slightly increase empathy
    if ((emotionalDelta.attachment || 0) > 10) {
        adjustment.empathy = (adjustment.empathy || 0) + driftRate;
    }

    // Fatigue/negative memories increase safety_weight
    if ((emotionalDelta.fatigue || 0) > 10 || (emotionalDelta.joy || 0) < -10) {
        adjustment.safety_weight = driftRate;
        adjustment.confidence = -driftRate * 0.5;
    }

    const processing = (emotionalDelta.joy || 0) > 0
        ? `Reinforcing positive experience about "${memory.topic}"`
        : `Processing challenging experience about "${memory.topic}"`;

    return { processing, adjustment };
}

/**
 * Apply accumulated dream drift to personality
 */
async function applyDreamDrift(userId, adjustments) {
    const current = await getPersonalitySnapshot(userId);

    for (const [trait, delta] of Object.entries(adjustments)) {
        if (current[trait] !== undefined) {
            current[trait] = Math.max(0, Math.min(1, current[trait] + delta));
        }
    }

    await prisma.personalityState.update({
        where: { userId },
        data: {
            traits: JSON.stringify(current),
            lastDriftUpdate: new Date(),
        },
    });
}
