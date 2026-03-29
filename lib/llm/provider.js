import Groq from 'groq-sdk';
import { GoogleGenerativeAI } from "@google/generative-ai";

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY,
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const visionModel = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

/**
 * Extract a valid JSON object from a string that might contain other text.
 */
function extractJSON(text) {
    try {
        const match = text.match(/\{[\s\S]*\}/);
        if (!match) return null;
        return JSON.parse(match[0]);
    } catch (e) {
        return null;
    }
}

/**
 * Generate a vision-aware response from Gemini 3 Flash
 */
export async function generateVisionResponse(systemPrompt, userMessage, imageData) {
    let attempts = 0;
    const maxAttempts = 2;

    while (attempts < maxAttempts) {
        try {
            console.log(`[NOVA VISION] Generating visual response via Gemini 3 (Attempt ${attempts + 1}/${maxAttempts})...`);
            
            const chatPrompt = [
                { text: systemPrompt },
                { text: `[VISUAL CONTEXT]: The following image is a real-time capture of the user's current computer screen.
[CRITICAL INSTRUCTION]: You MUST respond with a SINGLE, VALID JSON OBJECT containing exactly two keys: "expression" and "message". 
Example: { "expression": "thinking", "message": "I see you're working on some code." }` },
                imageData, 
                { text: userMessage }
            ];

            const result = await visionModel.generateContent(chatPrompt);
            const response = await result.response;
            const rawText = response.text();
            
            const parsedContent = extractJSON(rawText);
            
            if (!parsedContent) {
                console.error('[NOVA VISION] Failed to extract JSON from vision response:', rawText);
                throw new Error('Invalid JSON structure from vision model');
            }

            return {
                content: parsedContent.message,
                expression: parsedContent.expression || 'neutral',
                tool_calls: null,
                usage: null
            };
        } catch (error) {
            attempts++;
            const status = error.status || (error.response?.status);
            console.error(`[NOVA VISION] LLM Vision error (Status: ${status}):`, error.message);

            // If Gemini 3 is failing specifically, try a silent fallback to Gemini 2.5 Flash on attempt 2
            if (attempts === 1) {
                console.log('[NOVA VISION] Retrying in 15 seconds to allow quota reset...');
                await new Promise(resolve => setTimeout(resolve, 15000));
            } else {
                return {
                    content: `My eyes are a bit blurry right now (Status ${status || 'Unknown'}). I'm looking at your Gemini 3 quota, but I saw nothing. Try again in about 30 seconds?`,
                    expression: 'fatigue',
                    tool_calls: null,
                    usage: null
                };
            }
        }
    }
}

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
            },
            {
                type: "function",
                function: {
                    name: "execute_system_command",
                    description: "Execute a local shell command on the user's host machine (Windows). Use this to open apps (e.g. 'start code'), folders (e.g. 'start explorer .'), specific files, or directories.",
                    parameters: {
                        type: "object",
                        properties: {
                            command: {
                                type: "string",
                                description: "The terminal command to run (e.g., 'start code', 'start spotify', 'calc')."
                            }
                        },
                        required: ["command"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "view_screen",
                    description: "Captures a real-time image of the user's primary monitor. Use this ONLY if the user asks you to look at something, read their screen, identify a window, or see what they are doing.",
                    parameters: {
                        type: "object",
                        properties: {}
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "read_file",
                    description: "Reads the content of a local text-based file. If no absolute path is provided, it defaults to looking in the 'nova_workspace' folder.",
                    parameters: {
                        type: "object",
                        properties: {
                            filePath: {
                                type: "string",
                                description: "The path to the file to read (e.g., 'hello.txt', 'C:/Users/Admin/Desktop/notes.txt')."
                            }
                        },
                        required: ["filePath"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "write_file",
                    description: "Creates or overwrites a local file with the provided text content. If no absolute path is provided, it saves to the 'nova_workspace' folder. Useful for writing code, notes, or logs.",
                    parameters: {
                        type: "object",
                        properties: {
                            filePath: {
                                type: "string",
                                description: "The path or filename to write to (e.g., 'script.py', 'C:/Users/Admin/Desktop/report.md')."
                            },
                            content: {
                                type: "string",
                                description: "The text content to save into the file."
                            }
                        },
                        required: ["filePath", "content"]
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
