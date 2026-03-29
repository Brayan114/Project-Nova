import prisma from '../prisma.js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Prisma } from '@prisma/client';

// Initialize Gemini Embedding Engine
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const embeddingModel = genAI.getGenerativeModel({ model: "gemini-embedding-2-preview" });

/**
 * Generate a 768-dimensional embedding for content
 */
export async function generateEmbedding(content) {
    try {
        const result = await embeddingModel.embedContent({
            content: { parts: [{ text: content }] },
            outputDimensionality: 768
        });
        return result.embedding.values;
    } catch (error) {
        console.error('Embedding Generation Error:', error);
        return null;
    }
}

/**
 * Convert a JS float array to a pgvector-compatible string: "[0.1,0.2,...]"
 */
function toVectorString(arr) {
    return `[${arr.join(',')}]`;
}

/**
 * Store an episodic memory from an interaction
 */
export async function storeEpisodicMemory(userId, data) {
    const { topic, summary, emotionalBefore, emotionalAfter, importanceScore, tags } = data;

    const memory = await prisma.episodicMemory.create({
        data: {
            userId,
            topic: topic || 'general',
            summary,
            emotionalBefore: JSON.stringify(emotionalBefore),
            emotionalAfter: JSON.stringify(emotionalAfter),
            importanceScore: importanceScore || calculateImportance(summary, emotionalBefore, emotionalAfter),
            tags: JSON.stringify(tags || []),
        },
    });

    // Generate and store embedding
    const embedding = await generateEmbedding(summary);
    if (embedding) {
        const vecStr = toVectorString(embedding);
        await prisma.$executeRawUnsafe(
            `UPDATE "EpisodicMemory" SET embedding = $1::vector WHERE id = $2`,
            vecStr, memory.id
        );
    }

    return memory;
}

/**
 * Store a semantic fact extracted from conversation
 */
export async function storeSemanticMemory(userId, fact, relevanceScore = 0.5, tags = []) {
    // Check for duplicate facts
    const existing = await prisma.semanticMemory.findFirst({
        where: { userId, fact },
    });

    let memory;
    if (existing) {
        // Boost relevance of existing fact and merge tags
        const existingTags = JSON.parse(existing.tags || '[]');
        const combinedTags = [...new Set([...existingTags, ...tags])];
        
        memory = await prisma.semanticMemory.update({
            where: { id: existing.id },
            data: { 
                relevanceScore: Math.min(1, existing.relevanceScore + 0.1),
                tags: JSON.stringify(combinedTags)
            },
        });
    } else {
        memory = await prisma.semanticMemory.create({
            data: { userId, fact, relevanceScore, tags: JSON.stringify(tags) },
        });
    }

    // Generate/Update embedding
    const embedding = await generateEmbedding(fact);
    if (embedding) {
        const vecStr = toVectorString(embedding);
        await prisma.$executeRawUnsafe(
            `UPDATE "SemanticMemory" SET embedding = $1::vector WHERE id = $2`,
            vecStr, memory.id
        );
    }

    return memory;
}

/**
 * Get the most frequent topics from recent episodic memories
 */
export async function getRecentTopics(userId, limit = 5) {
    // Fetch recent summaries/topics to find what's current
    const recent = await prisma.episodicMemory.findMany({
        where: { userId },
        orderBy: { timestamp: 'desc' },
        take: 20,
        select: { topic: true }
    });

    const topics = recent
        .map(m => m.topic)
        .filter(t => t && t !== 'general');

    // Count and return top unique ones
    const counts = topics.reduce((acc, t) => {
        acc[t] = (acc[t] || 0) + 1;
        return acc;
    }, {});

    return Object.keys(counts)
        .sort((a, b) => counts[b] - counts[a])
        .slice(0, limit);
}

/**
 * Retrieve relevant memories using Vector Cosine Similarity Search
 */
export async function retrieveRelevantMemories(userId, query, limit = 3) {
    const embedding = await generateEmbedding(query);
    if (!embedding) {
        console.warn('[NOVA MEMORY] Embedding generation failed, falling back to empty.');
        return [];
    }

    const vecStr = toVectorString(embedding);

    // Search across Episodic and Semantic tables using Cosine Similarity (<=>)
    let episodicMatches = [];
    let semanticMatches = [];

    try {
        episodicMatches = await prisma.$queryRawUnsafe(
            `SELECT id, summary as content, topic, "importanceScore", timestamp, tags,
                    (embedding <=> $1::vector) as distance
             FROM "EpisodicMemory"
             WHERE "userId" = $2 AND embedding IS NOT NULL
             ORDER BY distance ASC
             LIMIT $3`,
            vecStr, userId, limit
        );
    } catch (e) {
        console.error('[NOVA MEMORY] Episodic vector search error:', e.message);
    }

    try {
        semanticMatches = await prisma.$queryRawUnsafe(
            `SELECT id, fact as content, "relevanceScore",
                    (embedding <=> $1::vector) as distance
             FROM "SemanticMemory"
             WHERE "userId" = $2 AND embedding IS NOT NULL
             ORDER BY distance ASC
             LIMIT $3`,
            vecStr, userId, limit
        );
    } catch (e) {
        console.error('[NOVA MEMORY] Semantic vector search error:', e.message);
    }

    // Process and merge results
    const episodic = episodicMatches.map(mem => ({
        type: 'episodic',
        content: mem.content,
        topic: mem.topic,
        score: 1 - Number(mem.distance),
        timestamp: mem.timestamp,
        tags: JSON.parse(mem.tags || '[]'),
    }));

    const semantic = semanticMatches.map(mem => ({
        type: 'semantic',
        content: mem.content,
        score: 1 - Number(mem.distance),
    }));

    const results = [...episodic, ...semantic]
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);

    console.log(`[NOVA MEMORY] Vector search returned ${results.length} memories for: "${query.substring(0, 50)}"`);
    return results;
}

/**
 * Get a summary of recent memories for display
 */
export async function getRecentMemories(userId, limit = 10) {
    const episodic = await prisma.episodicMemory.findMany({
        where: { userId },
        orderBy: { timestamp: 'desc' },
        take: limit,
    });

    const semantic = await prisma.semanticMemory.findMany({
        where: { userId },
        orderBy: { relevanceScore: 'desc' },
        take: limit,
    });

    return {
        episodic: episodic.map(m => ({
            id: m.id,
            topic: m.topic,
            summary: m.summary,
            importanceScore: m.importanceScore,
            timestamp: m.timestamp,
            tags: JSON.parse(m.tags),
        })),
        semantic: semantic.map(m => ({
            id: m.id,
            fact: m.fact,
            relevanceScore: m.relevanceScore,
        })),
    };
}

/**
 * Extract semantic facts from a conversation exchange
 */
export function extractFacts(userMessage, aiResponse) {
    const facts = [];
    const lower = userMessage.toLowerCase();

    // Pattern matching for fact extraction
    const patterns = [
        { regex: /my name is (\w+)/i, template: (m) => `User's name is ${m[1]}` },
        { regex: /i(?:'m| am) (?:a |an )?(\w+(?:\s\w+)?)/i, template: (m) => `User is ${m[1]}` },
        { regex: /i live in (.+?)(?:\.|$)/i, template: (m) => `User lives in ${m[1].trim()}` },
        { regex: /i (?:like|love|enjoy) (.+?)(?:\.|$)/i, template: (m) => `User likes ${m[1].trim()}` },
        { regex: /i (?:hate|dislike|don't like) (.+?)(?:\.|$)/i, template: (m) => `User dislikes ${m[1].trim()}` },
        { regex: /i work (?:as|in|at) (.+?)(?:\.|$)/i, template: (m) => `User works as/in ${m[1].trim()}` },
        { regex: /i(?:'m| am) (\d+) years? old/i, template: (m) => `User is ${m[1]} years old` },
        { regex: /my favorite (.+?) is (.+?)(?:\.|$)/i, template: (m) => `User's favorite ${m[1].trim()} is ${m[2].trim()}` },
    ];

    for (const pattern of patterns) {
        const match = userMessage.match(pattern.regex);
        if (match) {
            facts.push(pattern.template(match));
        }
    }

    return facts;
}

/**
 * Calculate importance based on emotional shift and content
 */
function calculateImportance(summary, emotionalBefore, emotionalAfter) {
    let importance = 0.3; // Base importance

    // High emotional shift = high importance
    if (emotionalBefore && emotionalAfter) {
        const keys = Object.keys(emotionalBefore);
        let totalShift = 0;
        for (const key of keys) {
            totalShift += Math.abs((emotionalAfter[key] || 0) - (emotionalBefore[key] || 0));
        }
        importance += Math.min(totalShift / 100, 0.4);
    }

    // Longer summaries tend to be more important
    if (summary && summary.length > 100) importance += 0.1;
    if (summary && summary.length > 200) importance += 0.1;

    return Math.min(importance, 1.0);
}
