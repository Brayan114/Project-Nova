import { NextResponse } from 'next/server';
import { createSandboxAgent, getSandboxAgents, runSandboxSimulation } from '@/lib/engine/sandbox';
import { runDreamMode } from '@/lib/engine/dreams';

export async function POST(request) {
    try {
        const body = await request.json();
        const { action, userId, agentName, personalityOverrides, rounds } = body;

        if (!userId) {
            return NextResponse.json(
                { error: 'userId is required' },
                { status: 400 }
            );
        }

        switch (action) {
            case 'create_agent': {
                if (!agentName) {
                    return NextResponse.json(
                        { error: 'agentName is required' },
                        { status: 400 }
                    );
                }
                const agent = await createSandboxAgent(userId, agentName, personalityOverrides || {});
                return NextResponse.json({ success: true, agent });
            }

            case 'list_agents': {
                const agents = await getSandboxAgents(userId);
                return NextResponse.json({ success: true, agents });
            }

            case 'run_simulation': {
                const result = await runSandboxSimulation(userId, rounds || 3);
                return NextResponse.json({ success: true, result });
            }

            case 'dream_mode': {
                const dreamResult = await runDreamMode(userId);
                return NextResponse.json({ success: true, result: dreamResult });
            }

            case 'force_connection': {
                // Instantly max out connection_need and wipe out fatigue so the Initiative Engine triggers this second.
                const stateRecord = await import('@/lib/prisma.js').then(m => m.default).then(prisma => prisma.emotionalState.findUnique({ where: { userId } }));
                if (stateRecord) {
                    const drives = JSON.parse(stateRecord.drives || '{}');
                    const emotions = JSON.parse(stateRecord.emotions || '{}');

                    drives.connection_need = 100;
                    emotions.fatigue = 0;

                    await import('@/lib/prisma.js').then(m => m.default).then(prisma => prisma.emotionalState.update({
                        where: { userId },
                        data: { drives: JSON.stringify(drives), emotions: JSON.stringify(emotions) }
                    }));
                }
                return NextResponse.json({ success: true, message: 'Connection Need maxed out.' });
            }

            default:
                return NextResponse.json(
                    { error: 'Invalid action. Use: create_agent, list_agents, run_simulation, dream_mode' },
                    { status: 400 }
                );
        }
    } catch (error) {
        console.error('Sandbox error:', error);
        return NextResponse.json(
            { error: 'Sandbox operation failed', details: error.message },
            { status: 500 }
        );
    }
}
