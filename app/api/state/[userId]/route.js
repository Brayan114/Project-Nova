import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getPersonalitySnapshot } from '@/lib/engine/personality';
import { getEmotionalState } from '@/lib/engine/emotions';
import { getRecentMemories } from '@/lib/engine/memory';
import { getRelationshipContext } from '@/lib/engine/relationship';
import { emotionToFace } from '@/lib/face/face-mapper';

export async function GET(request, { params }) {
    try {
        const { userId } = await params;

        // Get user
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            return NextResponse.json(
                { error: 'User not found' },
                { status: 404 }
            );
        }

        // Get all state
        const personality = await getPersonalitySnapshot(userId);
        const { emotions, drives } = await getEmotionalState(userId);
        const memories = await getRecentMemories(userId, 10);
        const relationship = getRelationshipContext(user.relationshipScore);
        const face = emotionToFace(emotions);

        return NextResponse.json({
            user: {
                id: user.id,
                displayName: user.displayName,
                interactionCount: user.interactionCount,
                createdAt: user.createdAt,
            },
            personality,
            emotionalState: emotions,
            drives,
            relationship: {
                ...relationship,
                score: user.relationshipScore,
            },
            face,
            memories,
        });
    } catch (error) {
        console.error('State error:', error);
        return NextResponse.json(
            { error: 'Failed to get state' },
            { status: 500 }
        );
    }
}
