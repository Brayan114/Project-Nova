import prisma from '../prisma.js';

/**
 * Update relationship score based on interaction type
 */
export async function updateRelationship(userId, interactionData) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return 0;

    let score = user.relationshipScore;
    const attachmentRate = 0.8;

    // Positive interactions increase relationship
    if (interactionData.sentiment > 0.5) {
        score += interactionData.sentiment * attachmentRate * 2;
    }

    // Attachment/gratitude boosts
    if (interactionData.attachment > 0) {
        score += interactionData.attachment * 0.3;
    }

    // Humor builds connection
    if (interactionData.humor > 0.3) {
        score += interactionData.humor * 1.5;
    }

    // Conflict reduces relationship
    if (interactionData.conflict > 0.3) {
        score -= interactionData.conflict * 5;
    }

    // Natural decay over time (very slight)
    score -= 0.1;

    // Clamp 0-100
    score = Math.max(0, Math.min(100, score));

    await prisma.user.update({
        where: { id: userId },
        data: {
            relationshipScore: score,
            interactionCount: { increment: 1 },
        },
    });

    return score;
}

/**
 * Map relationship score to behavioral context
 */
export function getRelationshipContext(score) {
    if (score >= 80) {
        return {
            level: 'deep',
            warmthModifier: 1.5,
            initiativeModifier: 1.3,
            callbackFrequency: 'high',
            description: 'Close and trusted companion',
        };
    } else if (score >= 60) {
        return {
            level: 'familiar',
            warmthModifier: 1.2,
            initiativeModifier: 1.1,
            callbackFrequency: 'moderate',
            description: 'Familiar and friendly',
        };
    } else if (score >= 30) {
        return {
            level: 'developing',
            warmthModifier: 1.0,
            initiativeModifier: 0.9,
            callbackFrequency: 'low',
            description: 'Getting to know each other',
        };
    } else {
        return {
            level: 'new',
            warmthModifier: 0.8,
            initiativeModifier: 0.5,
            callbackFrequency: 'rare',
            description: 'New acquaintance',
        };
    }
}
