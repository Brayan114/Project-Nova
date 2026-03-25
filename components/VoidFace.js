'use client';

import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ─── FVP Emotion Dictionary ─────────────────────────────────────────
const EMOTION_MAP = {
    joy: { leftEye: '^', rightEye: '^', mouth: 'D' },
    calm: { leftEye: '-', rightEye: '-', mouth: '_' },
    mischief: { leftEye: '>', rightEye: '<', mouth: ')' },
    attachment: { leftEye: 'O', rightEye: 'O', mouth: 'u' },
    fatigue: { leftEye: '-', rightEye: '-', mouth: '.' },
    curiosity: { leftEye: 'O', rightEye: 'O', mouth: 'o' },
    confidence: { leftEye: '•', rightEye: '•', mouth: '>' },
    neutral: { leftEye: '•', rightEye: '•', mouth: '_' },
};

// Blended states for when two emotions are close
const BLENDED_MAP = {
    'joy+mischief': { leftEye: '^', rightEye: '<', mouth: 'D' },
    'joy+attachment': { leftEye: '^', rightEye: '^', mouth: 'u' },
    'curiosity+joy': { leftEye: 'O', rightEye: 'O', mouth: 'D' },
    'calm+attachment': { leftEye: '-', rightEye: '-', mouth: 'u' },
    'fatigue+calm': { leftEye: '_', rightEye: '_', mouth: '.' },
    'confidence+mischief': { leftEye: '•', rightEye: '<', mouth: ')' },
};

// ─── Emotion → Glow Color Mapping ──────────────────────────────────
const GLOW_COLORS = {
    joy: '#ffd700',
    calm: '#35ffa0',
    mischief: '#ff3e9a',
    attachment: '#ff7eb3',
    fatigue: '#6a6a8a',
    curiosity: '#00d4ff',
    confidence: '#ff6b35',
    neutral: '#8a66ff',
};

// ─── Logic Hook ─────────────────────────────────────────────────────
function getDominantEmotion(emotions) {
    if (!emotions || Object.keys(emotions).length === 0) {
        return { dominant: 'neutral', secondary: null, face: EMOTION_MAP.neutral };
    }

    const sorted = Object.entries(emotions)
        .filter(([key]) => key in EMOTION_MAP)
        .sort(([, a], [, b]) => b - a);

    if (sorted.length === 0) {
        return { dominant: 'neutral', secondary: null, face: EMOTION_MAP.neutral };
    }

    const [dominant, dominantVal] = sorted[0];
    const [secondary, secondaryVal] = sorted.length > 1 ? sorted[1] : [null, 0];

    // Check for blended state if secondary is strong enough
    if (secondary && secondaryVal > 40 && dominantVal - secondaryVal < 20) {
        const key1 = `${dominant}+${secondary}`;
        const key2 = `${secondary}+${dominant}`;
        const blended = BLENDED_MAP[key1] || BLENDED_MAP[key2];
        if (blended) {
            return { dominant, secondary, face: blended };
        }
    }

    return {
        dominant,
        secondary,
        face: EMOTION_MAP[dominant] || EMOTION_MAP.neutral,
    };
}

// ─── Framer Motion Variants ─────────────────────────────────────────
const charVariants = {
    initial: { opacity: 0, y: 8, scale: 0.8 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, y: -8, scale: 0.8 },
};

const charTransition = {
    duration: 0.3,
    ease: [0.4, 0, 0.2, 1],
};

// ─── Component ──────────────────────────────────────────────────────
export default function VoidFace({ emotions = {} }) {
    const { dominant, face } = useMemo(
        () => getDominantEmotion(emotions),
        [emotions]
    );

    const glowColor = GLOW_COLORS[dominant] || GLOW_COLORS.neutral;

    // Dynamic text-shadow for glow effect
    const glowStyle = {
        '--glow-color': glowColor,
        textShadow: [
            `0 0 10px ${glowColor}`,
            `0 0 30px ${glowColor}`,
            `0 0 60px ${glowColor}80`,
            `0 0 100px ${glowColor}40`,
        ].join(', '),
    };

    return (
        <div className="voidface-container" style={glowStyle}>
            <div className="voidface-inner voidface-breathe">

                {/* Left Eye */}
                <AnimatePresence mode="wait">
                    <motion.span
                        key={`L-${face.leftEye}`}
                        className="voidface-char voidface-eye"
                        variants={charVariants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        transition={charTransition}
                    >
                        {face.leftEye}
                    </motion.span>
                </AnimatePresence>

                {/* Spacer */}
                <span className="voidface-spacer" />

                {/* Mouth */}
                <AnimatePresence mode="wait">
                    <motion.span
                        key={`M-${face.mouth}`}
                        className="voidface-char voidface-mouth"
                        variants={charVariants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        transition={{ ...charTransition, delay: 0.05 }}
                    >
                        {face.mouth}
                    </motion.span>
                </AnimatePresence>

                {/* Spacer */}
                <span className="voidface-spacer" />

                {/* Right Eye */}
                <AnimatePresence mode="wait">
                    <motion.span
                        key={`R-${face.rightEye}`}
                        className="voidface-char voidface-eye"
                        variants={charVariants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        transition={{ ...charTransition, delay: 0.1 }}
                    >
                        {face.rightEye}
                    </motion.span>
                </AnimatePresence>

            </div>
        </div>
    );
}
