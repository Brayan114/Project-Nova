'use client';

/**
 * Mood Dashboard — shows emotions, drives, relationship score, and personality traits
 */
export default function MoodDashboard({ emotions = {}, drives = {}, relationship = {}, personality = {} }) {
    const emotionColors = {
        joy: 'bar-joy',
        curiosity: 'bar-curiosity',
        confidence: 'bar-confidence',
        mischief: 'bar-mischief',
        calm: 'bar-calm',
        attachment: 'bar-attachment',
        fatigue: 'bar-fatigue',
    };

    const driveColors = {
        novelty_need: 'bar-novelty',
        connection_need: 'bar-connection',
        competence_need: 'bar-competence',
        coherence_need: 'bar-coherence',
        safety_need: 'bar-safety',
    };

    const driveLabels = {
        novelty_need: 'Novelty',
        connection_need: 'Connection',
        competence_need: 'Competence',
        coherence_need: 'Coherence',
        safety_need: 'Safety',
    };

    return (
        <div>
            {/* Relationship */}
            <div className="mood-section">
                <h3>Relationship</h3>
                <div className="relationship-gauge">
                    <div className="score">{(relationship.score || 0).toFixed(0)}</div>
                    <div className="level">{relationship.description || 'New acquaintance'}</div>
                </div>
            </div>

            {/* Emotions */}
            <div className="mood-section">
                <h3>Emotional State</h3>
                {Object.entries(emotionColors).map(([key, colorClass]) => (
                    <div key={key} className="emotion-bar">
                        <span className="label">{key}</span>
                        <div className="bar-container">
                            <div
                                className={`bar-fill ${colorClass}`}
                                style={{ width: `${(emotions[key] || 0)}%` }}
                            />
                        </div>
                        <span className="value">{(emotions[key] || 0).toFixed(0)}</span>
                    </div>
                ))}
            </div>

            {/* Drives */}
            <div className="mood-section">
                <h3>Active Drives</h3>
                {Object.entries(driveColors).map(([key, colorClass]) => (
                    <div key={key} className="emotion-bar">
                        <span className="label">{driveLabels[key]}</span>
                        <div className="bar-container">
                            <div
                                className={`bar-fill ${colorClass}`}
                                style={{ width: `${(drives[key] || 0)}%` }}
                            />
                        </div>
                        <span className="value">{(drives[key] || 0).toFixed(0)}</span>
                    </div>
                ))}
            </div>

            {/* Personality Traits */}
            {Object.keys(personality).length > 0 && (
                <div className="mood-section">
                    <h3>Personality</h3>
                    {Object.entries(personality).map(([key, value]) => (
                        <div key={key} className="trait-row">
                            <span className="label">{key.replace(/_/g, ' ')}</span>
                            <div className="bar-container">
                                <div
                                    className="bar-fill"
                                    style={{ width: `${(value || 0) * 100}%` }}
                                />
                            </div>
                            <span className="value">{((value || 0) * 100).toFixed(0)}%</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
