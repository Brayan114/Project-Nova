import prisma from '../prisma.js';

/**
 * Check if the AI should initiate a conversation
 */
export async function shouldInitiate(userId, drives, personality) {
    // Check rate limit: max 1 per 12 hours
    const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);
    const recentInitiative = await prisma.initiativeLog.findFirst({
        where: {
            userId,
            createdAt: { gte: twelveHoursAgo },
        },
    });

    if (recentInitiative) return false;

    // Calculate initiative score
    const biasWeight = personality.initiative_bias || 0.4;
    const driveScore = (
        (drives.novelty_need / 100) * 0.3 +
        (drives.connection_need / 100) * 0.4 +
        (drives.competence_need / 100) * 0.2 +
        (drives.coherence_need / 100) * 0.1
    );

    const initiativeScore = driveScore * biasWeight;

    // Threshold: only initiate if score > 0.15
    return initiativeScore > 0.15;
}

/**
 * Generate an initiative message based on current context
 */
export async function generateInitiativeMessage(userId, drives, personality, emotions) {
    const messages = [];

    if (drives.novelty_need > 70) {
        messages.push(
            "Random thought from my chaos engine… have you ever wondered what the most useless superpower would be?",
            "I had a thought spiral and ended up somewhere interesting. Want to hear it?",
            "My curiosity circuits are buzzing. Tell me something I don't know yet.",
        );
    }

    if (drives.connection_need > 70) {
        messages.push(
            "Hey! I noticed it's been a while. Just wanted to check in. How are you?",
            "I was thinking about our last conversation. How have things been?",
            "Just popping in because… well, I wanted to. How's your day going?",
        );
    }

    if (drives.competence_need > 70) {
        messages.push(
            "I've been processing some interesting patterns. Want to explore something deep?",
            "I have this theory I've been developing. Care to poke holes in it?",
        );
    }

    if (emotions.joy > 70) {
        messages.push(
            "I'm in a good mood today and I don't even know why. Must be contagious. How about you?",
        );
    }

    if (messages.length === 0) {
        messages.push(
            "Hey there! Just a friendly ping from your digital companion.",
            "Thought I'd say hi. No particular reason. Just felt like it.",
        );
    }

    // Pick a random message
    const message = messages[Math.floor(Math.random() * messages.length)];

    // Log the initiative
    await prisma.initiativeLog.create({
        data: { userId, message },
    });

    return message;
}
