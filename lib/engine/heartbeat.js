import cron from 'node-cron';
import prisma from '../prisma.js';
import { updateEmotionalState, getEmotionalState } from './emotions.js';
import { getPersonalitySnapshot } from './personality.js';
import { generateResponse } from '../llm/provider.js';
import { buildPrompt } from '../llm/prompt-builder.js';

let isRunning = false;

export function startHeartbeat() {
    if (isRunning) return;
    isRunning = true;
    console.log('NOVA Heartbeat Engine started.');

    // Run every 15 minutes
    cron.schedule('*/15 * * * *', async () => {
        try {
            await runHeartbeatTick();
        } catch (err) {
            console.error('Heartbeat error:', err);
        }
    });
}

async function runHeartbeatTick() {
    console.log('Running NOVA 15-minute background tick...');

    const users = await prisma.user.findMany();

    const now = new Date();
    const hour = now.getHours();
    const isAwakeTime = hour >= 9 && hour <= 22; // 9 AM to 10 PM

    for (const user of users) {
        // Simulate time passing: increase connection need, decay emotions
        const personality = await getPersonalitySnapshot(user.id);
        const { emotions: currentEmotions, drives: currentDrives } = await getEmotionalState(user.id);

        const timeStimulus = {
            sentiment: 0.5,
            calm: 5,        // drifting toward calm
            attachment: 0,
            novelty: -0.5,  // novelty need increases 
            fatigue: -5     // resting
        };

        // Boost connection need directly
        currentDrives.connection_need = Math.min(100, currentDrives.connection_need + 5);

        // Update state in DB
        await prisma.emotionalState.update({
            where: { userId: user.id },
            data: { drives: JSON.stringify(currentDrives) }
        });

        const { emotions, drives } = await updateEmotionalState(user.id, timeStimulus, personality);

        // CHECK AUTONOMOUS INITIATIVE
        if (isAwakeTime && drives.connection_need > 80 && emotions.fatigue < 40) {
            // Check if she hasn't initiated recently
            const recentInitiative = await prisma.initiativeLog.findFirst({
                where: {
                    userId: user.id,
                    createdAt: { gte: new Date(Date.now() - 4 * 60 * 60 * 1000) } // 4 hours
                }
            });

            if (!recentInitiative) {
                await generateAutonomousMessage(user.id, personality, emotions, drives);
            }
        }
    }
}

async function generateAutonomousMessage(userId, personality, emotions, drives) {
    console.log(`Generating autonomous message for user ${userId}...`);

    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { relationshipScore: true, displayName: true }
    });

    const relationshipData = {
        level: user.relationshipScore > 50 ? 'Close' : 'Casual',
        score: user.relationshipScore,
        description: 'buddy'
    };

    const prompt = buildPrompt({
        personality,
        emotions,
        drives,
        relationship: relationshipData,
        memories: [],
        driveInfluence: {}
    });

    const initMessage = `You are initiating conversation with ${user.displayName} out of the blue because your connection_need is high. Say something completely random, unstructured, or sarcastic to start a chat. DO NOT ask "how can I assist you". Just drop a thought.`;

    const result = await generateResponse(prompt, initMessage, []);

    if (result && result.content) {
        await prisma.initiativeLog.create({
            data: {
                userId,
                message: result.content,
                delivered: false
            }
        });

        // Reset connection need since she reached out
        const updatedDrives = { ...drives, connection_need: 30 };
        await prisma.emotionalState.update({
            where: { userId },
            data: { drives: JSON.stringify(updatedDrives) }
        });
        console.log(`Stored autonomous message for ${userId}`);
    }
}
