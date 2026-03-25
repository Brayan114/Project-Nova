import prisma from '../prisma.js';
import { GoogleGenerativeAI } from '@google/generative-ai';

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
        await prisma.$executeRaw`
            UPDATE "EpisodicMemory" 
            SET embedding = ${embedding}::vector 
            WHERE id = ${memory.id}
        `;
    }

    return memory;
}

/**
 * Store a semantic fact extracted from conversation
 */
export async function storeSemanticMemory(userId, fact, relevanceScore = 0.5) {
    // Check for duplicate facts
    const existing = await prisma.semanticMemory.findFirst({
        where: { userId, fact },
    });

    let memory;
    if (existing) {
        // Boost relevance of existing fact
        memory = await prisma.semanticMemory.update({
            where: { id: existing.id },
            data: { relevanceScore: Math.min(1, existing.relevanceScore + 0.1) },
        });
    } else {
        memory = await prisma.semanticMemory.create({
            data: { userId, fact, relevanceScore },
        });
    }

    // Generate/Update embedding
    const embedding = await generateEmbedding(fact);
    if (embedding) {
        await prisma.$executeRaw`
            UPDATE "SemanticMemory" 
            SET embedding = ${embedding}::vector 
            WHERE id = ${memory.id}
        `;
    }

    return memory;
}

/**
 * Retrieve relevant memories using Vector Cosine Similarity Search
 */
export async function retrieveRelevantMemories(userId, query, limit = 3) {
    const embedding = await generateEmbedding(query);
    if (!embedding) return [];

    // Search across Episodic and Semantic tables using Cosine Similarity (<=>)
    // We cast the embedding to ::vector for pgvector
    const episodicMatches = await prisma.$queryRaw`
        SELECT 
            id, summary as content, topic, "importanceScore", timestamp, tags,
            (embedding <=> ${embedding}::vector) as distance
        FROM "EpisodicMemory"
        WHERE "userId" = ${userId}
        ORDER BY distance ASC
        LIMIT ${limit}
    `;

    const semanticMatches = await prisma.$queryRaw`
        SELECT 
            id, fact as content, "relevanceScore", 
            (embedding <=> ${embedding}::vector) as distance
        FROM "SemanticMemory"
        WHERE "userId" = ${userId}
        ORDER BY distance ASC
        LIMIT ${limit}
    `;

    // Process and merge results
    const episodic = episodicMatches.map(mem => ({
        type: 'episodic',
        content: mem.content,
        topic: mem.topic,
        score: 1 - mem.distance, // Convert distance to similarity score
        timestamp: mem.timestamp,
        tags: JSON.parse(mem.tags || '[]'),
    }));

    const semantic = semanticMatches.map(mem => ({
        type: 'semantic',
        content: mem.content,
        score: 1 - mem.distance,
    }));

    // Combine and take top 3 total as requested ("perform a Cosine Similarity search... to find the top 3 most semantically similar past memories")
    return [...episodic, ...semantic]
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);
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
