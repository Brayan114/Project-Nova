import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { initializePersonality } from '@/lib/engine/personality';
import { initializeEmotionalState } from '@/lib/engine/emotions';

export async function POST(request) {
    try {
        const body = await request.json();
        const { displayName } = body;

        if (!displayName || displayName.trim().length === 0) {
            return NextResponse.json(
                { error: 'displayName is required' },
                { status: 400 }
            );
        }

        // Create user
        const user = await prisma.user.create({
            data: {
                displayName: displayName.trim(),
            },
        });

        // Initialize personality state
        await initializePersonality(user.id);

        // Initialize emotional state
        await initializeEmotionalState(user.id);

        return NextResponse.json({
            success: true,
            user: {
                id: user.id,
                displayName: user.displayName,
                relationshipScore: user.relationshipScore,
                interactionCount: user.interactionCount,
            },
        });
    } catch (error) {
        console.error('Create user error:', error);
        return NextResponse.json(
            { error: 'Failed to create user' },
            { status: 500 }
        );
    }
}
