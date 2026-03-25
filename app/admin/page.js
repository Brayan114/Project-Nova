'use client';

import { useState, useEffect, useCallback } from 'react';
import NovaFace from '@/components/NovaFace';
import ChatInterface from '@/components/ChatInterface';
import MoodDashboard from '@/components/MoodDashboard';
import MemoryPanel from '@/components/MemoryPanel';
import SandboxPanel from '@/components/SandboxPanel';
import WhatsAppPanel from '@/components/WhatsAppPanel';

export default function Home() {
  const [userId, setUserId] = useState(null);
  const [displayName, setDisplayName] = useState('');
  const [creating, setCreating] = useState(false);
  const [activeTab, setActiveTab] = useState('mood');

  // Companion state
  const [emotions, setEmotions] = useState({});
  const [drives, setDrives] = useState({});
  const [personality, setPersonality] = useState({});
  const [relationship, setRelationship] = useState({});
  const [memories, setMemories] = useState({});
  const [face, setFace] = useState(null);

  // Check for saved user
  useEffect(() => {
    const savedId = localStorage.getItem('nova_user_id');
    if (savedId) {
      setUserId(savedId);
      loadState(savedId);
    }
  }, []);

  async function loadState(id) {
    try {
      const res = await fetch(`/api/state/${id}`);
      const data = await res.json();

      if (data.error) {
        // User not found, clear local storage
        localStorage.removeItem('nova_user_id');
        setUserId(null);
        return;
      }

      setEmotions(data.emotionalState || {});
      setDrives(data.drives || {});
      setPersonality(data.personality || {});
      setRelationship(data.relationship || {});
      setMemories(data.memories || {});
      setFace(data.face);
    } catch (err) {
      console.error('Load state error:', err);
    }
  }

  async function createUser() {
    if (!displayName.trim() || creating) return;
    setCreating(true);

    try {
      const res = await fetch('/api/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: displayName.trim() }),
      });
      const data = await res.json();

      if (data.success) {
        localStorage.setItem('nova_user_id', data.user.id);
        setUserId(data.user.id);
        loadState(data.user.id);
      }
    } catch (err) {
      console.error('Create user error:', err);
    }

    setCreating(false);
  }

  const handleNewState = useCallback((state) => {
    if (state.emotions) setEmotions(state.emotions);
    if (state.drives) setDrives(state.drives);
    if (state.relationshipScore !== undefined) {
      setRelationship(prev => ({ ...prev, score: state.relationshipScore }));
    }
    if (state.face) setFace(state.face);

    // Refresh full state periodically
    if (userId) {
      loadState(userId);
    }
  }, [userId]);

  // Onboarding screen
  if (!userId) {
    return (
      <div className="onboarding">
        <NovaFace emotions={{ calm: 60, curiosity: 40 }} size={180} />
        <h1>NOVA</h1>
        <p>
          Your persistent AI companion. Emotionally dynamic, memory-driven, and uniquely yours.
        </p>
        <div className="onboarding-input">
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="What should I call you?"
            onKeyDown={(e) => e.key === 'Enter' && createUser()}
            autoFocus
          />
          <button onClick={createUser} disabled={!displayName.trim() || creating}>
            {creating ? 'Creating...' : 'Begin'}
          </button>
        </div>
      </div>
    );
  }

  // Main app
  return (
    <div className="app-container">
      {/* Main chat panel */}
      <div className="main-panel">
        <div className="chat-header">
          <NovaFace emotions={emotions} size={48} />
          <div className="chat-header-info">
            <h2>
              <span className="status-dot"></span>
              NOVA
            </h2>
            <p>{face?.label || 'neutral'} • {relationship.description || 'getting to know you'}</p>
          </div>
        </div>

        <ChatInterface userId={userId} onNewState={handleNewState} />
      </div>

      {/* Side panel */}
      <div className="side-panel">
        <NovaFace emotions={emotions} size={140} />

        <div className="side-tabs">
          <button
            className={`side-tab ${activeTab === 'mood' ? 'active' : ''}`}
            onClick={() => setActiveTab('mood')}
          >
            Mood
          </button>
          <button
            className={`side-tab ${activeTab === 'memory' ? 'active' : ''}`}
            onClick={() => setActiveTab('memory')}
          >
            Memory
          </button>
          <button
            className={`side-tab ${activeTab === 'sandbox' ? 'active' : ''}`}
            onClick={() => setActiveTab('sandbox')}
          >
            Sandbox
          </button>
          <button
            className={`side-tab ${activeTab === 'whatsapp' ? 'active' : ''}`}
            onClick={() => setActiveTab('whatsapp')}
          >
            WhatsApp
          </button>
        </div>

        <div className="side-content">
          {activeTab === 'mood' && (
            <MoodDashboard
              emotions={emotions}
              drives={drives}
              relationship={relationship}
              personality={personality}
            />
          )}
          {activeTab === 'memory' && (
            <MemoryPanel memories={memories} />
          )}
          {activeTab === 'sandbox' && (
            <SandboxPanel userId={userId} />
          )}
          {activeTab === 'whatsapp' && (
            <WhatsAppPanel />
          )}
        </div>
      </div>
    </div>
  );
}
