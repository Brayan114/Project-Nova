'use client';

/**
 * Memory Panel — shows recent episodic and semantic memories
 */
export default function MemoryPanel({ memories = {} }) {
    const { episodic = [], semantic = [] } = memories;

    function timeAgo(timestamp) {
        const seconds = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000);
        if (seconds < 60) return 'just now';
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
        return `${Math.floor(seconds / 86400)}d ago`;
    }

    return (
        <div>
            {/* Episodic memories */}
            <div className="mood-section">
                <h3>Recent Memories</h3>
                {episodic.length === 0 ? (
                    <div className="empty-state">
                        <div className="icon">🧠</div>
                        <p>No memories yet. Start chatting to build memories together.</p>
                    </div>
                ) : (
                    episodic.map((mem) => (
                        <div key={mem.id} className="memory-item">
                            <div className="topic">{mem.topic}</div>
                            <div className="summary">{mem.summary}</div>
                            <div className="meta">
                                {timeAgo(mem.timestamp)} • importance: {(mem.importanceScore * 100).toFixed(0)}%
                                {mem.tags.length > 0 && ` • ${mem.tags.join(', ')}`}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Semantic facts */}
            <div className="mood-section">
                <h3>Known Facts</h3>
                {semantic.length === 0 ? (
                    <div className="empty-state">
                        <div className="icon">📝</div>
                        <p>Nova hasn't learned any facts about you yet.</p>
                    </div>
                ) : (
                    semantic.map((mem) => (
                        <div key={mem.id} className="semantic-fact">
                            {mem.fact}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
