'use client';

import { useState, useRef, useEffect } from 'react';

/**
 * Chat Interface with message input, display, and _._  face per message
 */
export default function ChatInterface({ userId, onNewState }) {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const messagesEndRef = useRef(null);
    const textareaRef = useRef(null);
    const recognitionRef = useRef(null);
    const audioRef = useRef(null);

    // Initialize Speech Recognition
    useEffect(() => {
        if (typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            recognitionRef.current = new SpeechRecognition();
            recognitionRef.current.continuous = true;
            recognitionRef.current.interimResults = true;

            recognitionRef.current.onresult = (event) => {
                let currentTranscript = '';
                for (let i = event.resultIndex; i < event.results.length; i++) {
                    const transcript = event.results[i][0].transcript;
                    if (event.results[i].isFinal) {
                        setInput((prev) => prev + transcript + ' ');
                    } else {
                        currentTranscript += transcript;
                        // Optional: Could display interim results in the placeholder if you want
                    }
                }
            };

            recognitionRef.current.onerror = (event) => {
                console.error("Speech recognition error", event.error);
                setIsListening(false);
            };

            recognitionRef.current.onend = () => {
                setIsListening(false);
            };
        }
    }, []);

    const toggleListening = () => {
        if (!recognitionRef.current) {
            alert("Voice input is not supported in this browser.");
            return;
        }

        if (isListening) {
            recognitionRef.current.stop();
        } else {
            recognitionRef.current.start();
            setIsListening(true);
        }
    };

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(scrollToBottom, [messages]);

    // Auto-resize textarea
    useEffect(() => {
        const ta = textareaRef.current;
        if (ta) {
            ta.style.height = '44px';
            ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
        }
    }, [input]);

    // Poll for autonomous messages
    useEffect(() => {
        if (!userId) return;

        const interval = setInterval(async () => {
            try {
                const res = await fetch('/api/initiative/pending', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId }),
                });

                if (!res.ok) return;

                const data = await res.json();

                if (data.success && data.message) {
                    setMessages(prev => [
                        ...prev,
                        {
                            role: 'nova',
                            content: data.message.content,
                            face: data.message.face,
                        },
                    ]);
                }
            } catch (err) {
                console.error('Polling error:', err);
            }
        }, 15000); // Poll every 15 seconds

        return () => clearInterval(interval);
    }, [userId]);

    // TTS Playback Helper
    async function playTTS(text) {
        try {
            const res = await fetch('/api/tts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text })
            });
            if (res.ok) {
                const data = await res.json();
                if (data.audioContent && audioRef.current) {
                    const audioSrc = `data:audio/mp3;base64,${data.audioContent}`;
                    audioRef.current.src = audioSrc;
                    audioRef.current.play().catch(e => console.error("Audio playback blocked", e));
                }
            }
        } catch (e) {
            console.error("Failed to generate TTS", e);
        }
    }

    async function sendMessage() {
        if (!input.trim() || loading) return;

        const userMessage = input.trim();
        setInput('');
        setLoading(true);

        // Add user message immediately
        setMessages(prev => [...prev, { role: 'user', content: userMessage }]);

        try {
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, message: userMessage }),
            });

            const data = await res.json();

            if (data.success) {
                // Propagate state update IMMEDIATELY to trigger face change
                if (onNewState) {
                    onNewState({
                        emotions: data.emotionalState,
                        drives: data.drives,
                        relationshipScore: data.relationshipScore,
                        face: data.face, // The new parsed expression face
                    });
                }

                // Fire off the TTS immediately so it buffers while the "typing..." animation plays
                if (data.response) {
                    playTTS(data.response);
                }

                // THE HOLLYWOOD UI TRICK
                // Keep the "typing..." indicator up for an extra 1.5 seconds 
                // while the face has already reacted to the user's input.
                setTimeout(() => {
                    setMessages(prev => [
                        ...prev,
                        {
                            role: 'nova',
                            content: data.response,
                            face: data.face,
                        },
                    ]);
                    setLoading(false);
                }, 1500);

            } else {
                setMessages(prev => [
                    ...prev,
                    { role: 'system', content: 'Something went wrong. Please try again.' },
                ]);
                setLoading(false);
            }
        } catch (err) {
            console.error('Chat error:', err);
            setMessages(prev => [
                ...prev,
                { role: 'system', content: 'Connection error. Please check your connection.' },
            ]);
            setLoading(false);
        }
    }

    function handleKeyDown(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    }

    return (
        <div className="chat-container">
            <div className="chat-messages">
                {messages.length === 0 && (
                    <div style={{ height: '80px' }}></div>
                )}

                {messages.map((msg, i) => (
                    <div key={i} className={`message ${msg.role}`}>
                        {msg.content}
                    </div>
                ))}

                {loading && (
                    <div className="message nova">
                        <div className="typing-indicator">
                            <span></span>
                            <span></span>
                            <span></span>
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            <div className="chat-input-area">
                <div className="chat-input-wrapper">
                    <textarea
                        ref={textareaRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Talk to Nova..."
                        rows={1}
                        disabled={loading}
                    />
                    <button
                        onClick={input.trim() ? sendMessage : toggleListening}
                        disabled={loading}
                        className={isListening ? 'mic-active' : ''}
                        title={input.trim() ? "Send" : (isListening ? "Stop listening" : "Start speaking")}
                    >
                        {input.trim() ? (
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="22" y1="2" x2="11" y2="13"></line>
                                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                            </svg>
                        ) : (
                            isListening ? (
                                <svg viewBox="0 0 24 24" fill="none" stroke="var(--emotion-mischief)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                                </svg>
                            ) : (
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                                    <line x1="12" y1="19" x2="12" y2="23"></line>
                                    <line x1="8" y1="23" x2="16" y2="23"></line>
                                </svg>
                            )
                        )}
                    </button>
                </div>
            </div>

            {/* Hidden Audio Element for Voice Synthesis */}
            <audio ref={audioRef} style={{ display: 'none' }} />
        </div>
    );
}
