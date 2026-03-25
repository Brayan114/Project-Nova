'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import VoidFace from '@/components/VoidFace';

// Emotion → glow color mapping
const GLOW_COLORS = {
  joy: '#ffd700',
  curiosity: '#00d4ff',
  confidence: '#ff6b35',
  mischief: '#c24fff',
  calm: '#35ffa0',
  attachment: '#ff7eb3',
  fatigue: '#6a6a8a',
  neutral: '#8a66ff',
};

// Get the dominant emotion from the state vector
function getDominantEmotion(emotions) {
  if (!emotions || Object.keys(emotions).length === 0) return 'neutral';
  const sorted = Object.entries(emotions).sort(([, a], [, b]) => b - a);
  return sorted[0][0];
}

export default function Home() {
  const [userId, setUserId] = useState(null);
  const [displayName, setDisplayName] = useState('');
  const [creating, setCreating] = useState(false);

  // Companion state
  const [emotions, setEmotions] = useState({ calm: 60, curiosity: 40 });
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  // Refs
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const audioRef = useRef(null);

  // Speech recognition
  const [isListening, setIsListening] = useState(false);
  const [micError, setMicError] = useState(null);
  const recognitionRef = useRef(null);
  const silenceTimerRef = useRef(null);

  // Check for saved user
  useEffect(() => {
    const savedId = localStorage.getItem('nova_user_id');
    if (savedId) {
      setUserId(savedId);
      loadState(savedId);
    }
  }, []);

  // Set up speech recognition
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onresult = (event) => {
          let interimTranscript = '';
          let finalTranscript = '';

          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript;
            } else {
              interimTranscript += event.results[i][0].transcript;
            }
          }

          // If we have final text, append it. If we have interim text, replace the current pending part.
          // For simplicity in this UI, we just overwrite the input with whatever the recognizer hears in this session.
          // Since it's continuous, it builds the string linearly.
          const fullTranscript = Array.from(event.results)
            .map(res => res[0].transcript)
            .join('');

          setInput(fullTranscript);

          // Clear previous silence timer
          if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
          }

          // Set auto-submit trigger after 1.5s of silence
          silenceTimerRef.current = setTimeout(() => {
            recognition.stop();
            setIsListening(false);
            // We use a functional state update to guarantee we get the latest input for sendMessage
            setInput((latestInput) => {
              if (latestInput.trim()) {
                // Call actual send function logic directly since we can't easily await state updates
                submitVoiceMessage(latestInput.trim());
              }
              return latestInput;
            });
          }, 1500);
        };

        recognition.onerror = (event) => {
          setIsListening(false);
          if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
            setMicError('Mic access denied by the void.');
            setTimeout(() => setMicError(null), 4000);
          }
        };

        recognition.onend = () => {
          setIsListening(false);
          if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
          }
        };

        recognitionRef.current = recognition;
      } else {
        setMicError('Speech recognition not supported in this void.');
      }
    }

    return () => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    };
  }, []);

  async function loadState(id) {
    try {
      const res = await fetch(`/api/state/${id}`);
      const data = await res.json();
      if (data.error) {
        localStorage.removeItem('nova_user_id');
        setUserId(null);
        return;
      }
      setEmotions(data.emotionalState || {});
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

  // TTS playback
  async function playTTS(text) {
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      if (audioRef.current) {
        audioRef.current.src = url;
        audioRef.current.play().catch(() => { });
      }
    } catch (e) {
      console.error('TTS error:', e);
    }
  }

  // Helper for voice auto-submit so it grabs the closure argument directly
  async function submitVoiceMessage(userMsg) {
    if (loading) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, message: userMsg }),
      });
      const data = await res.json();

      if (data.success) {
        setMessages(prev => [...prev, { role: 'nova', content: data.response }]);
        if (data.emotionalState) setEmotions(data.emotionalState);
        if (data.response) playTTS(data.response);
      } else {
        setMessages(prev => [...prev, { role: 'nova', content: 'Something went wrong... try again?' }]);
      }
    } catch (err) {
      console.error('Chat error:', err);
      setMessages(prev => [...prev, { role: 'nova', content: 'Connection lost. Try again?' }]);
    }
    setLoading(false);
  }

  async function sendMessage() {
    if (!input.trim() || loading) return;
    submitVoiceMessage(input.trim());
  }

  function toggleListening() {
    if (!recognitionRef.current) {
      setMicError('Speech recognition not supported in this void.');
      setTimeout(() => setMicError(null), 4000);
      return;
    }
    if (isListening) {
      // Manual stop: abort listening and submit whatever we've got
      recognitionRef.current.stop();
      setIsListening(false);
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (input.trim()) {
        submitVoiceMessage(input.trim());
      }
    } else {
      // Start fresh
      setInput('');
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (e) {
        console.error('Recognition start error:', e);
      }
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  // Auto-scroll chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Computed values
  const dominantEmotion = getDominantEmotion(emotions);
  const glowColor = GLOW_COLORS[dominantEmotion] || GLOW_COLORS.neutral;
  const visibleMessages = messages.slice(-3); // Only show last 3

  // --- ONBOARDING ---
  if (!userId) {
    return (
      <div className="void-container">
        <div className="void-face-stage">
          <VoidFace emotions={{ calm: 60, curiosity: 40 }} />
        </div>
        <div className="void-onboarding">
          <h1 className="void-title">NOVA</h1>
          <p className="void-subtitle">your resident chaotic digital buddy.</p>
          <div className="void-onboarding-input-row">
            <input
              className="void-onboarding-field"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="what's your name, human?"
              onKeyDown={(e) => e.key === 'Enter' && createUser()}
              autoFocus
            />
            <button
              className="void-onboarding-btn"
              onClick={createUser}
              disabled={!displayName.trim() || creating}
            >
              {creating ? '...' : '→'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- MAIN UI ---
  return (
    <div className="void-container">
      {/* Top UI Layer: Admin Gear & Mic Error Toast */}
      <div className="void-top-layer">
        <Link href="/admin" className="void-admin-gear" title="Admin">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </Link>

        {micError && (
          <div className="void-error-toast">
            {micError}
          </div>
        )}
      </div>

      {/* Center Stage: Face */}
      <div className="void-face-stage">
        <VoidFace emotions={emotions} />
      </div>

      {/* Bottom Chat Layer */}
      <div className="void-chat-panel">
        <div className="void-messages-scroll">
          {visibleMessages.length === 0 && !loading && (
            <div className="void-empty-hint">say something to the void...</div>
          )}

          {visibleMessages.map((msg, i) => (
            <div key={i} className={`void-message void-message-${msg.role}`}>
              {msg.role === 'nova' && (
                <div className="void-message-avatar">
                  <span className="void-avatar-dot" style={{ background: glowColor }} />
                </div>
              )}
              <div className="void-message-bubble">
                {msg.content}
              </div>
              {msg.role === 'user' && (
                <div className="void-message-avatar void-avatar-user">
                  <span className="void-avatar-dot void-avatar-dot-user" />
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="void-message void-message-nova">
              <div className="void-message-avatar">
                <span className="void-avatar-dot" style={{ background: glowColor }} />
              </div>
              <div className="void-message-bubble">
                <div className="void-typing">
                  <span /><span /><span />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Pill Input */}
        <div className="void-input-bar">
          <div className="void-input-pill">
            <input
              ref={inputRef}
              className="void-input-field"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Say something to the void..."
              disabled={loading}
            />
            <button
              className={`void-input-btn ${isListening ? 'void-mic-active' : ''}`}
              onClick={input.trim() && !isListening ? sendMessage : toggleListening}
              disabled={loading || !!micError}
              style={micError ? { opacity: 0.5 } : {}}
            >
              {input.trim() ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              ) : isListening ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="23" />
                  <line x1="8" y1="23" x2="16" y2="23" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Hidden audio for TTS */}
      <audio ref={audioRef} style={{ display: 'none' }} />
    </div>
  );
}
