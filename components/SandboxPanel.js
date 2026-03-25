'use client';

import { useState } from 'react';

/**
 * Sandbox Panel — manage sandbox agents, run simulations, dream mode
 */
export default function SandboxPanel({ userId }) {
    const [agents, setAgents] = useState([]);
    const [newAgentName, setNewAgentName] = useState('');
    const [simLog, setSimLog] = useState([]);
    const [dreamResult, setDreamResult] = useState(null);
    const [loading, setLoading] = useState('');

    async function loadAgents() {
        try {
            const res = await fetch('/api/sandbox', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'list_agents', userId }),
            });
            const data = await res.json();
            if (data.success) setAgents(data.agents);
        } catch (err) {
            console.error('Load agents error:', err);
        }
    }

    async function createAgent() {
        if (!newAgentName.trim()) return;
        setLoading('create');

        try {
            const res = await fetch('/api/sandbox', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'create_agent',
                    userId,
                    agentName: newAgentName.trim(),
                }),
            });
            const data = await res.json();
            if (data.success) {
                setNewAgentName('');
                await loadAgents();
            }
        } catch (err) {
            console.error('Create agent error:', err);
        }

        setLoading('');
    }

    async function runSimulation() {
        setLoading('sim');
        setSimLog([]);

        try {
            const res = await fetch('/api/sandbox', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'run_simulation', userId, rounds: 3 }),
            });
            const data = await res.json();
            if (data.success && data.result) {
                setSimLog(data.result.log || []);
                await loadAgents(); // Refresh agent states
            }
        } catch (err) {
            console.error('Simulation error:', err);
        }

        setLoading('');
    }

    async function runDreamMode() {
        setLoading('dream');
        setDreamResult(null);

        try {
            const res = await fetch('/api/sandbox', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'dream_mode', userId }),
            });
            const data = await res.json();
            if (data.success) {
                setDreamResult(data.result);
            }
        } catch (err) {
            console.error('Dream mode error:', err);
        }

        setLoading('');
    }

    // Load agents on mount
    useState(() => {
        if (userId) loadAgents();
    });

    return (
        <div>
            {/* Create Agent */}
            <div className="mood-section">
                <h3>Sandbox Agents</h3>
                <div className="sandbox-controls">
                    <input
                        value={newAgentName}
                        onChange={(e) => setNewAgentName(e.target.value)}
                        placeholder="Agent name..."
                        onKeyDown={(e) => e.key === 'Enter' && createAgent()}
                    />
                    <button className="btn-primary" onClick={createAgent} disabled={loading === 'create'}>
                        {loading === 'create' ? <span className="loading-spinner" /> : '+'}
                    </button>
                </div>

                {agents.length === 0 ? (
                    <div className="empty-state">
                        <div className="icon">🤖</div>
                        <p>No sandbox agents. Create at least 2 to run simulations.</p>
                    </div>
                ) : (
                    agents.map((agent) => (
                        <div key={agent.id} className="sandbox-agent">
                            <div className="agent-name">{agent.name}</div>
                            <div className="agent-stats">
                                <span>Joy: {agent.emotions.joy?.toFixed(0)}</span>
                                <span>Curiosity: {agent.emotions.curiosity?.toFixed(0)}</span>
                                <span>Empathy: {((agent.personality.empathy || 0) * 100).toFixed(0)}%</span>
                                <span>Mischief: {((agent.personality.mischief || 0) * 100).toFixed(0)}%</span>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Simulation Controls */}
            <div className="mood-section">
                <h3>Simulation</h3>
                <div className="sandbox-controls">
                    <button
                        className="btn-secondary"
                        onClick={runSimulation}
                        disabled={agents.length < 2 || loading === 'sim'}
                        style={{ flex: 1 }}
                    >
                        {loading === 'sim' ? 'Simulating...' : '▶ Run Simulation'}
                    </button>
                    <button
                        className="btn-secondary"
                        onClick={runDreamMode}
                        disabled={loading === 'dream'}
                        style={{ flex: 1 }}
                    >
                        {loading === 'dream' ? 'Dreaming...' : '☾ Dream Mode'}
                    </button>
                    <button
                        className="btn-secondary"
                        onClick={async () => {
                            setLoading('force');
                            await fetch('/api/sandbox', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ action: 'force_connection', userId })
                            });
                            setLoading('');
                        }}
                        disabled={loading === 'force'}
                        style={{ flex: 1, backgroundColor: 'rgba(124, 91, 245, 0.2)', borderColor: 'var(--emotion-mischief)' }}
                    >
                        {loading === 'force' ? 'Forcing...' : '⚡ Force Connect'}
                    </button>
                </div>

                {/* Simulation Log */}
                {simLog.length > 0 && (
                    <div className="simulation-log">
                        {simLog.map((entry, i) => (
                            <div key={i} className="sim-entry">
                                <div className="round">Round {entry.round}</div>
                                <strong>{entry.speaker}</strong> → <strong>{entry.listener}</strong>
                                <br />
                                <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>{entry.exchange}</span>
                            </div>
                        ))}
                    </div>
                )}

                {/* Dream Result */}
                {dreamResult && (
                    <div className="simulation-log">
                        <div className="sim-entry">
                            <div className="round">Dream Mode Complete</div>
                            {dreamResult.success ? (
                                <>
                                    <p>Processed {dreamResult.memoriesProcessed} memories</p>
                                    {dreamResult.dreamLog?.map((entry, i) => (
                                        <p key={i} style={{ fontSize: '0.75rem', marginTop: 4 }}>
                                            ☾ {entry.processing}
                                        </p>
                                    ))}
                                </>
                            ) : (
                                <p>{dreamResult.reason}</p>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
