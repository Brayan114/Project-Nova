import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma.js';
import { getEmotionalState, updateEmotionalState } from '@/lib/engine/emotions.js';
import { getPersonalitySnapshot } from '@/lib/engine/personality.js';
import { generateResponse } from '@/lib/llm/provider.js';
import { buildPrompt } from '@/lib/llm/prompt-builder.js';

function getNovaFace(emotions) {
    // Basic mapping for the payload
    let face = '- _ -';
    let label = 'neutral';

    if (emotions.joy > 70) { face = '^ _ ^'; label = 'joy'; }
    else if (emotions.mischief > 70) { face = '> _ <'; label = 'mischief'; }
    else if (emotions.fatigue > 70) { face = '~ _ ~'; label = 'fatigue'; }
    else if (emotions.curiosity > 70) { face = 'o _ O'; label = 'curiosity'; }
    else if (emotions.calm > 70) { face = '- _ -'; label = 'calm'; }
    else if (emotions.attachment > 70) { face = 'o _ o'; label = 'attachment'; }

    return { face, label };
}

export async function POST(req) {
    try {
        const { userId } = await req.json();

        if (!userId) {
            return NextResponse.json({ success: false, error: 'User ID required' }, { status: 400 });
        }

        // Check for pending messages
        const unreadLog = await prisma.initiativeLog.findFirst({
            where: {
                userId,
                delivered: false
            },
            orderBy: {
                createdAt: 'asc'
            }
        });

        if (!unreadLog) {
            // No pending message. Let's evaluate if we should generate one right now.
            const { emotions, drives } = await getEmotionalState(userId);

            // Only trigger if Connection Need is VERY high (>80) and she's not exhausted
            if (drives.connection_need > 80 && emotions.fatigue < 40) {
                // Rate limit: check if she already sent one recently (last 1 hour)
                const lastHour = new Date(Date.now() - 60 * 60 * 1000);
                const recentInitiative = await prisma.initiativeLog.findFirst({
                    where: { userId, createdAt: { gte: lastHour } }
                });

                if (!recentInitiative) {
                    await generateAutonomousMessage(userId, emotions, drives);
                    // It will be picked up on the NEXT 15-second poll
                }
            }

            return NextResponse.json({ success: true, message: null });
        }

        // Mark as delivered
        await prisma.initiativeLog.update({
            where: { id: unreadLog.id },
            data: { delivered: true }
        });

        // Get current emotional state for face mapping
        const { emotions } = await getEmotionalState(userId);
        const face = getNovaFace(emotions);

        return NextResponse.json({
            success: true,
            message: {
                content: unreadLog.message,
                face: face
            }
        });

    } catch (error) {
        console.error('Polling error:', error);
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}

// Inline generation function to allow the polling route to handle it live
async function generateAutonomousMessage(userId, emotions, drives) {
    console.log(`[NOVA] Autonomously generating a message for user ${userId}...`);

    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { relationshipScore: true, displayName: true }
    });

    const personality = await getPersonalitySnapshot(userId);

    const prompt = buildPrompt({
        personality,
        emotions,
        drives,
        relationship: { level: user.relationshipScore > 50 ? 'Close' : 'Casual', score: user.relationshipScore },
        memories: [],
        driveInfluence: {}
    });

    // Extremely specific prompt instruction telling her to text first
    const initMessage = `[SYSTEM MESSAGE]: You are staring at the chat interface and the user (${user.displayName || 'the user'}) hasn't said anything in a while. Your 'Connection' drive is currently peaking at ${drives.connection_need}/100. 
Generate a completely random, unprompted text message to them. Do not act like an assistant asking "how can I help". Just drop a thought, a sarcastic observation, or a random fact as if you literally just picked up your phone to text them out of boredom.`;

    const result = await generateResponse(prompt, initMessage, []);

    if (result && result.content) {
        // Save the generated message to the database
        await prisma.initiativeLog.create({
            data: {
                userId,
                message: result.content,
                delivered: false // The frontend will pick this up on the next poll
            }
        });

        // Reset her connection need back down since she reached out
        const updatedDrives = { ...drives, connection_need: 30 };
        await prisma.emotionalState.update({
            where: { userId },
            data: { drives: JSON.stringify(updatedDrives) }
        });
        console.log(`[NOVA] Successfully stored autonomous message.`);
    }
}
