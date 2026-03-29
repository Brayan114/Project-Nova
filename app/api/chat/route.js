import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma.js';
import { getPersonalitySnapshot, driftPersonality } from '@/lib/engine/personality.js';
import { getEmotionalState, analyzeSentiment, updateEmotionalState, getDriveInfluence } from '@/lib/engine/emotions.js';
import { retrieveRelevantMemories, storeEpisodicMemory, storeSemanticMemory, extractFacts } from '@/lib/engine/memory.js';
import { updateRelationship, getRelationshipContext } from '@/lib/engine/relationship.js';
import { getModulationInstructions, extractTopic } from '@/lib/engine/modulation.js';
import { applySafetyGuardrails, detectVulnerability } from '@/lib/engine/safety.js';
import { emotionToFace } from '@/lib/face/face-mapper.js';
import { generateResponse, generateVisionResponse } from '@/lib/llm/provider.js';
import { buildPrompt } from '@/lib/llm/prompt-builder.js';
import { performWebSearch } from '@/lib/engine/search.js';
import { sendWhatsAppMessage } from '@/lib/clients/whatsapp.js';
import { executeLocalCommand } from '@/lib/clients/system.js';
import { captureScreen } from '@/lib/clients/vision.js';
import { readLocalFile, writeLocalFile } from '@/lib/clients/filesystem.js';

export async function POST(request) {
    try {
        const body = await request.json();
        const { userId, message, history: conversationHistory = [] } = body;

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
                const toolName = call.function.name;
                const toolArgs = args;

                if (toolName === 'send_whatsapp_message') {
                    const { contactName, messageContent } = toolArgs;
                    const waResult = await sendWhatsAppMessage(contactName, messageContent);
                    
                    const waContext = `\n\n[SYSTEM STATUS]: ${waResult.message} Inform the user you've sent it with your usual wit.`;
                    llmResult = await generateResponse(systemPrompt + waContext, message, conversationHistory, true);
                    response = llmResult.content || "I've sent that WhatsApp message for you. Hopefully, they actually want to hear from you.";
                } else if (toolName === 'check_calendar') {
                    response = `[SYSTEM WORKER: Querying Calendar API -> Date: ${toolArgs.date || 'today'}] \n${response}`;
                } else if (toolName === 'search_web') {
                    // Actual autonomous execution
                    const searchResults = await performWebSearch(toolArgs.query);
                    console.log(`[NOVA] Searched for "${toolArgs.query}". Found ${searchResults.length} chars of data.`);

                    // We must ask the LLM *again*, injecting the live data into its brain.
                    const searchContext = `\n\n[SYSTEM WORKER]: You autonomously searched the live web for "${toolArgs.query}". The live results are:\n\n${searchResults}\n\nReview this data and incorporate it naturally into your response to the user. Do not say "Based on the search results..." just seamlessly state the facts like you knew them.`;

                    const enrichedPrompt = systemPrompt + searchContext;
                    llmResult = await generateResponse(enrichedPrompt, message, conversationHistory, true);
                    response = llmResult.content || "I found some stuff on the web, but my brain just went blank. Try asking me specifically about the results?";
                } else if (toolName === 'execute_system_command') {
                    // Local OS Control
                    const sysResult = await executeLocalCommand(toolArgs.command);
                    console.log(`[NOVA SYSTEM] Tool Execution Result:`, sysResult);
                    
                    const systemContext = `\n\n[SYSTEM STATUS: Action Performed] You successfully executed the command: "${toolArgs.command}" on the host machine. If there was an error, it was: "${sysResult.message}". Inform the user in your signature sarcastic style that you've done what they asked (or failed if necessary).`;
                    
                    const sysPrompt = systemPrompt + systemContext;
                    llmResult = await generateResponse(sysPrompt, message, conversationHistory, true);
                    response = llmResult.content || `I ran that command ("${toolArgs.command}"), but I'm too tired to tell you about it. It probably worked. Or not. Who knows?`;
                } else if (toolName === 'view_screen') {
                    // Optic Nerve: Capture screen and analyze via Gemini
                    const imageData = await captureScreen();
                    llmResult = await generateVisionResponse(systemPrompt, message, imageData);
                    response = llmResult.content || "I'm looking at your screen, but I'm literally speechless. Maybe try refreshing your view?";
                } else if (toolName === 'read_file') {
                    const { filePath } = toolArgs;
                    const fileContent = await readLocalFile(filePath);
                    
                    // Re-prompt with the file content
                    const intermediateMessage = `[SYSTEM]: File content of "${filePath}":\n\n${fileContent}`;
                    llmResult = await generateResponse(systemPrompt, intermediateMessage, conversationHistory, true);
                    response = llmResult.content || `I read that file ("${filePath}"), but the content was so boring I forgot what was in it. Try asking me again?`;
                } else if (toolName === 'write_file') {
                    const { filePath, content } = toolArgs;
                    const writeResult = await writeLocalFile(filePath, content);
                    
                    // Re-prompt with the success message
                    const intermediateMessage = `[SYSTEM]: ${writeResult.message}`;
                    llmResult = await generateResponse(systemPrompt, intermediateMessage, conversationHistory, true);
                    response = llmResult.content || `I've written that file for you. You're welcome, I guess. It's at ${writeResult.path}.`;
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
