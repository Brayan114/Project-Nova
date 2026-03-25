import Groq from 'groq-sdk';

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY,
});

/**
 * Generate a response from the Groq LLM
 */
export async function generateResponse(systemPrompt, userMessage, conversationHistory = [], disableTools = false) {
    try {
        const messages = [
            { role: 'system', content: systemPrompt },
            ...conversationHistory.slice(-10), // Keep last 10 messages for context
            { role: 'user', content: userMessage },
        ];

        const tools = [
            {
                type: "function",
                function: {
                    name: "search_web",
                    description: "Search the live internet for recent information, news, dates, weather, or facts. Use this IF the user asks you about current events or highly specific external facts you aren't sure about.",
                    parameters: {
                        type: "object",
                        properties: {
                            query: {
                                type: "string",
                                description: "The search query to look up (e.g., 'weather in Tokyo', 'latest SpaceX launch', 'who won the oscars 2024')"
                            }
                        },
                        required: ["query"],
                    },
                },
            },
            {
                type: "function",
                function: {
                    name: "send_whatsapp_message",
                    description: "Send a message to a contact via WhatsApp. Use this when the user explicitly asks you to text or message someone.",
                    parameters: {
                        type: "object",
                        properties: {
                            contactName: {
                                type: "string",
                                description: "The name of the person to message (e.g., 'Alice', 'my friend')."
                            },
                            messageContent: {
                                type: "string",
                                description: "The content of the message to send."
                            }
                        },
                        required: ["contactName", "messageContent"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "check_calendar",
                    description: "Check the user's schedule or calendar for events. Use this when the user asks what they have planned, what's on their schedule, or if they are busy.",
                    parameters: {
                        type: "object",
                        properties: {
                            date: {
                                type: "string",
                                description: "The date to check the schedule for, e.g., 'today', 'tomorrow', '2023-10-25'. Default is 'today'."
                            }
                        }
                    }
                }
            }
        ];

        const completionPayload = {
            model: 'llama-3.3-70b-versatile',
            messages,
            temperature: 0.85,
            max_tokens: 1024,
            top_p: 0.9,
            frequency_penalty: 0.3,
            presence_penalty: 0.4,
        };

        if (!disableTools) {
            completionPayload.tools = tools;
            completionPayload.tool_choice = "auto";
        }

        const completion = await groq.chat.completions.create(completionPayload);

        const rawContent = completion.choices[0]?.message?.content;
        let toolCalls = completion.choices[0]?.message?.tool_calls || null;

        // Catch hallucinated XML-style tool calls (e.g., <function=search_web{"query":"..."}></function>)
        if (rawContent && rawContent.includes('<function=')) {
            const match = rawContent.match(/<function=(\w+)(.*?)><\/function>/);
            if (match) {
                const funcName = match[1];
                let funcArgs = "{}";
                try {
                    funcArgs = match[2];
                    // Verify it's valid JSON
                    JSON.parse(funcArgs);

                    toolCalls = [{
                        function: {
                            name: funcName,
                            arguments: funcArgs
                        }
                    }];
                    console.log(`[NOVA] Caught hallucinated tool call: ${funcName} and successfully converted it.`);
                } catch (e) {
                    console.warn("[NOVA] Caught hallucinated tool call but args were invalid JSON:", funcArgs);
                }
            }
        }

        // Attempt to parse the JSON
        let parsedContent = { expression: 'neutral', message: '' };

        if (rawContent && rawContent.trim() !== '' && !rawContent.startsWith('<function=')) {
            try {
                // Strip markdown codeblocks if it wrapped the JSON
                let cleanContent = rawContent;
                if (cleanContent.startsWith('```json')) {
                    cleanContent = cleanContent.replace(/```json\n?/, '').replace(/```\n?$/, '');
                }

                parsedContent = JSON.parse(cleanContent);
                // Fallback if the AI returned a weird structure
                if (!parsedContent.message) parsedContent.message = cleanContent;
            } catch (e) {
                console.error("Failed to parse LLM JSON", e);
                parsedContent.message = rawContent; // Just use the raw string if it failed
            }
        }

        return {
            content: parsedContent.message,
            expression: parsedContent.expression || 'neutral',
            tool_calls: toolCalls,
            usage: completion.usage,
        };
    } catch (error) {
        console.error('LLM Error:', error.message || error);

        // Intercept Groq's 400 error for malformed tool generation
        // e.g. {"error":{"message":"...", "failed_generation":"<function=search_web{\"query\":\"...\"}></function>"}}
        const failedGen = error.error?.failed_generation || (error.response?.error?.failed_generation) || error.message;

        if (failedGen && failedGen.includes('<function=')) {
            // Note: LLM often hallucinates the tag without the closing > before </function>
            const match = failedGen.match(/<function=(\w+)(.*?)(?:>)?<\/function>/);
            if (match) {
                const funcName = match[1];
                let funcArgs = "{}";
                try {
                    // LLM might escape quotes inside the hallucinated string
                    funcArgs = match[2].trim().replace(/\\"/g, '"');
                    JSON.parse(funcArgs);

                    console.log(`[NOVA] Rescued hallucinated tool call from 400 crash: ${funcName}`);
                    return {
                        content: '',
                        expression: 'thinking',
                        tool_calls: [{
                            function: {
                                name: funcName,
                                arguments: funcArgs
                            }
                        }],
                        usage: null
                    };
                } catch (e) {
                    console.warn("[NOVA] Rescued tool call was completely invalid JSON:", funcArgs);
                }
            }
        }

        // True Fallback response
        return {
            content: 'My circuits are a bit tangled right now. Give me a moment and try again?',
            expression: 'fatigue',
            error: error.message,
        };
    }
}
