import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getPersonalitySnapshot, driftPersonality } from '@/lib/engine/personality';
import { getEmotionalState, analyzeSentiment, updateEmotionalState, getDriveInfluence } from '@/lib/engine/emotions';
import { retrieveRelevantMemories, storeEpisodicMemory, storeSemanticMemory, extractFacts } from '@/lib/engine/memory';
import { updateRelationship, getRelationshipContext } from '@/lib/engine/relationship';
import { getModulationInstructions, extractTopic } from '@/lib/engine/modulation';
import { applySafetyGuardrails, detectVulnerability } from '@/lib/engine/safety';
import { emotionToFace } from '@/lib/face/face-mapper';
import { generateResponse } from '@/lib/llm/provider';
import { buildPrompt } from '@/lib/llm/prompt-builder';
import { performWebSearch } from '@/lib/engine/search';

export async function POST(request) {
    try {
        const body = await request.json();
        const { userId, message } = body;

        if (!userId || !message) {
            return NextResponse.json(
                { error: 'userId and message are required' },
                { status: 400 }
            );
        }

        // Verify user exists
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            return NextResponse.json(
                { error: 'User not found' },
                { status: 404 }
            );
        }

        // 1. Get current state
        const personality = await getPersonalitySnapshot(userId);
        const { emotions: emotionsBefore, drives: drivesBefore } = await getEmotionalState(userId);

        // 2. Check for vulnerability
        const vulnerability = detectVulnerability(message);

        // 3. Analyze user message sentiment
        const stimulus = analyzeSentiment(message);

        // 4. Retrieve relevant memories
        const memories = await retrieveRelevantMemories(userId, message, 5);
        console.log(`[NOVA MEMORY ENGINE] Pulled ${memories.length} relevant memories for: "${message}"`);
        if (memories.length > 0) {
            console.log(`[NOVA MEMORY ENGINE] Top Memory:`, memories[0]);
        }

        // 5. Get relationship context
        const relationshipContext = getRelationshipContext(user.relationshipScore);
        relationshipContext.score = user.relationshipScore;

        // 6. Get drive influence
        const driveInfluence = getDriveInfluence(drivesBefore);

        // 7. Build prompt
        const systemPrompt = buildPrompt({
            personality,
            emotions: emotionsBefore,
            drives: drivesBefore,
            relationship: relationshipContext,
            memories,
            driveInfluence,
        });

        // 8. Generate response
        let response;
        let llmResult;

        if (vulnerability.detected) {
            llmResult = await generateResponse(systemPrompt, message);
            response = vulnerability.supportMessage + '\n\n' + (llmResult.content || '');
        } else {
            llmResult = await generateResponse(systemPrompt, message);
            response = llmResult.content || '';
        }

        // Handle tool calls as placeholders for now
        if (llmResult.tool_calls && llmResult.tool_calls.length > 0) {
            const call = llmResult.tool_calls[0];
            try {
                const args = JSON.parse(call.function.arguments);
                if (call.function.name === 'send_whatsapp_message') {
                    response = `[SYSTEM WORKER: Triggering WhatsApp API -> Contact: ${args.contactName}] \n${response}`;
                } else if (call.function.name === 'check_calendar') {
                    response = `[SYSTEM WORKER: Querying Calendar API -> Date: ${args.date || 'today'}] \n${response}`;
                } else if (call.function.name === 'search_web') {
                    // Actual autonomous execution
                    const searchResults = await performWebSearch(args.query);
                    console.log(`[NOVA] Searched for "${args.query}". Found ${searchResults.length} chars of data.`);

                    // We must ask the LLM *again*, injecting the live data into its brain.
                    const searchContext = `\n\n[SYSTEM WORKER]: You autonomously searched the live web for "${args.query}". The live results are:\n\n${searchResults}\n\nReview this data and incorporate it naturally into your response to the user. Do not say "Based on the search results..." just seamlessly state the facts like you knew them.`;

                    const enrichedPrompt = systemPrompt + searchContext;
                    llmResult = await generateResponse(enrichedPrompt, message);
                    response = llmResult.content || '';
                }
            } catch (e) {
                console.error("Error parsing tool arguments", e);
            }
        }

        // 9. Apply safety guardrails
        response = applySafetyGuardrails(response);

        // 10. Update emotional state
        const { emotions: emotionsAfter, drives: drivesAfter } = await updateEmotionalState(
            userId,
            stimulus,
            personality
        );

        // 11. Update relationship
        const newRelationshipScore = await updateRelationship(userId, stimulus);

        // 12. Store episodic memory
        const topic = extractTopic(message);
        await storeEpisodicMemory(userId, {
            topic,
            summary: `User said: "${message.substring(0, 200)}". Nova responded about ${topic}.`,
            emotionalBefore: emotionsBefore,
            emotionalAfter: emotionsAfter,
            tags: [topic],
        });

        // 13. Extract and store semantic facts
        const facts = extractFacts(message, response);
        for (const fact of facts) {
            await storeSemanticMemory(userId, fact);
        }

        // 14. Drift personality very slightly
        await driftPersonality(userId, stimulus);

        // 15. Generate face expression
        const face = emotionToFace(emotionsAfter);

        return NextResponse.json({
            success: true,
            response,
            face: { face: face.face, label: llmResult.expression }, // Override label with exact expression string
            emotionalState: emotionsAfter,
            drives: drivesAfter,
            relationshipScore: newRelationshipScore,
            topic,
            activeMemories: memories.map(m => m.content),
        });
    } catch (error) {
        console.error('Chat error:', error);
        return NextResponse.json(
            { error: 'Failed to process chat message', details: error.message },
            { status: 500 }
        );
    }
}
