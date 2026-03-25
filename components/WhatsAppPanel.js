'use client';

import { useState, useEffect } from 'react';

/**
 * WhatsApp Panel — Displays pairing QR code, status, and drafted replies (Triage)
 */
export default function WhatsAppPanel() {
    const [status, setStatus] = useState('disconnected');
    const [qrImage, setQrImage] = useState(null);
    const [loading, setLoading] = useState(true);
    const [drafts, setDrafts] = useState([]);

    async function checkStatus() {
        try {
            const res = await fetch('/api/whatsapp/qr');
            const data = await res.json();

            if (data.success) {
                setStatus(data.status);
                setQrImage(data.qrImage);

                if (data.status === 'connected') {
                    const draftsRes = await fetch('/api/whatsapp/drafts');
                    const draftsData = await draftsRes.json();
                    if (draftsData.success) {
                        setDrafts(draftsData.drafts);
                    }
                }
            }
        } catch (err) {
            console.error('Failed to fetch WhatsApp status', err);
        } finally {
            setLoading(false);
        }
    }

    // Poll the status every 3 seconds while viewing the panel
    useEffect(() => {
        checkStatus();
        const interval = setInterval(checkStatus, 3000);
        return () => clearInterval(interval);
    }, []);

    async function handleDraftAction(id, action) {
        try {
            const res = await fetch(`/api/whatsapp/drafts/${id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action })
            });
            const data = await res.json();
            if (data.success) {
                // Optimistic UI update
                setDrafts(prev => prev.filter(d => d.id !== id));
            } else {
                alert('Action failed: ' + data.error);
            }
        } catch (err) {
            console.error('Draft action failed', err);
        }
    }

    return (
        <div className="mood-section">
            <h3>WhatsApp Observer Node</h3>

            <div className={`status-badge ${status}`}>
                {status === 'connected' && '🟢 Connected'}
                {status === 'awaiting_scan' && '🟡 Awaiting Scan'}
                {status === 'disconnected' && '🔴 Disconnected'}
            </div>

            <div className="whatsapp-container" style={{ marginTop: '1rem' }}>
                {loading ? (
                    <p className="loading-spinner" style={{ margin: '2rem auto' }}></p>
                ) : status === 'connected' ? (
                    <div className="connected-state">
                        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📱</div>
                            <p>Linked to your personal WhatsApp!</p>
                            <p style={{ fontSize: '0.85rem', opacity: 0.7, marginTop: '0.5rem', maxWidth: '400px', margin: '0 auto' }}>
                                NOVA is secretly listening to incoming messages. When she thinks she has a good reply, it will appear below for your approval.
                            </p>
                        </div>

                        <div className="triage-section">
                            <h4 style={{ marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>Drafted Replies Triage</h4>
                            {drafts.length === 0 ? (
                                <div style={{ background: 'var(--panel-bg)', padding: '2rem', borderRadius: '12px', textAlign: 'center', color: '#888' }}>
                                    <p>No pending drafts right now. Awaiting incoming messages...</p>
                                </div>
                            ) : (
                                <div className="drafts-list" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    {drafts.map(draft => (
                                        <div key={draft.id} className="draft-card" style={{ background: 'var(--panel-bg)', padding: '1.5rem', borderRadius: '12px', borderLeft: '4px solid #6c5ce7' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                                                <strong>{draft.contact}</strong>
                                                <span style={{ fontSize: '0.8rem', opacity: 0.5 }}>
                                                    {new Date(draft.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>

                                            <div className="message-preview" style={{ marginBottom: '1rem', padding: '1rem', background: 'rgba(0,0,0,0.3)', borderRadius: '8px' }}>
                                                <div style={{ opacity: 0.7, fontSize: '0.8rem', marginBottom: '0.25rem' }}>They said:</div>
                                                <p style={{ wordBreak: 'break-word', fontSize: '0.95rem' }}>"{draft.incoming}"</p>
                                            </div>

                                            <div className="reply-preview" style={{ marginBottom: '1.5rem', padding: '1rem', background: 'rgba(108, 92, 231, 0.1)', borderRadius: '8px', border: '1px dashed rgba(108, 92, 231, 0.3)' }}>
                                                <div style={{ color: '#a29bfe', fontSize: '0.8rem', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                    <span className="status-dot" style={{ background: '#a29bfe', position: 'relative' }}></span>
                                                    NOVA suggests replying:
                                                </div>
                                                <p style={{ wordBreak: 'break-word', fontSize: '0.95rem' }}>{draft.draft}</p>
                                            </div>

                                            <div className="draft-actions" style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                                                <button
                                                    onClick={() => handleDraftAction(draft.id, 'reject')}
                                                    style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: 'white' }}>
                                                    Discard
                                                </button>
                                                <button
                                                    onClick={() => handleDraftAction(draft.id, 'approve')}
                                                    style={{ background: '#6c5ce7' }}>
                                                    Approve & Send
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                ) : qrImage ? (
                    <div className="qr-state" style={{ textAlign: 'center' }}>
                        <p style={{ marginBottom: '1rem' }}>Scan this QR code with WhatsApp (Linked Devices) to authorize NOVA's Node.js Observer.</p>
                        <img
                            src={qrImage}
                            alt="WhatsApp QR Code"
                            style={{ width: '250px', height: '250px', borderRadius: '12px', background: 'white', padding: '10px' }}
                        />
                    </div>
                ) : (
                    <div className="offline-state" style={{ textAlign: 'center' }}>
                        <p>Server is generating the pairing code...</p>
                        <p style={{ fontSize: '0.8rem', opacity: 0.5 }}>Check your terminal logs. The WhatsApp browser environment takes ~5 seconds to spin up.</p>
                    </div>
                )}
            </div>

            <style jsx>{`
                .status-badge {
                    display: inline-block;
                    padding: 4px 12px;
                    border-radius: 20px;
                    font-size: 0.8rem;
                    font-weight: 600;
                    letter-spacing: 0.5px;
                    text-transform: uppercase;
                }
                .status-badge.connected { background: rgba(46, 213, 115, 0.1); color: #2ed573; border: 1px solid rgba(46, 213, 115, 0.3); }
                .status-badge.awaiting_scan { background: rgba(255, 165, 2, 0.1); color: #ffa502; border: 1px solid rgba(255, 165, 2, 0.3); }
                .status-badge.disconnected { background: rgba(255, 71, 87, 0.1); color: #ff4757; border: 1px solid rgba(255, 71, 87, 0.3); }
            `}</style>
        </div>
    );
}
