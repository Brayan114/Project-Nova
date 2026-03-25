'use client';

import { useEffect, useState } from 'react';

/**
 * Renders floating contextual memory chips around the screen.
 * This visually proves to the user that NOVA's semantic memory engine is active.
 */
export default function MemoryChips({ memories = [] }) {
    const [positionedChips, setPositionedChips] = useState([]);

    useEffect(() => {
        if (!memories || memories.length === 0) {
            setPositionedChips([]);
            return;
        }

        // Assign random, non-overlapping starting positions for the chips around the center face
        const validPositions = [
            { top: '20%', left: '15%', delay: '0s' },
            { top: '15%', left: '70%', delay: '1s' },
            { top: '45%', left: '10%', delay: '0.5s' },
            { top: '35%', left: '80%', delay: '2s' },
            { top: '65%', left: '20%', delay: '1.5s' },
            { top: '60%', left: '75%', delay: '2.5s' }
        ];

        // Shuffle and slice
        const shuffled = [...validPositions].sort(() => 0.5 - Math.random());

        const mapped = memories.slice(0, 3).map((mem, i) => {
            const pos = shuffled[i % shuffled.length];
            return {
                id: `mem-${i}-${Date.now()}`,
                content: mem,
                style: {
                    top: pos.top,
                    left: pos.left,
                    animationDelay: pos.delay
                }
            };
        });

        setPositionedChips(mapped);
    }, [memories]);

    if (positionedChips.length === 0) return null;

    return (
        <div className="memory-chips-container">
            {positionedChips.map((chip) => (
                <div key={chip.id} className="memory-chip" style={chip.style}>
                    <span className="chip-icon">✦</span>
                    <span className="chip-text">NOVA remembers: {chip.content}</span>
                </div>
            ))}
        </div>
    );
}
