/**
 * Face Mapper
 * Maps emotional state to _._  face expressions
 */

// Face component definitions for each emotion
const FACE_MAP = {
    joy: { eyes: '^ ^', mouth: 'D', label: 'happy' },
    calm: { eyes: '- -', mouth: '_', label: 'calm' },
    mischief: { eyes: '> <', mouth: ')', label: 'mischievous' },
    attachment: { eyes: 'o o', mouth: 'u', label: 'affectionate' },
    fatigue: { eyes: '- -', mouth: '~', label: 'tired' },
    curiosity: { eyes: 'o O', mouth: '_', label: 'curious' },
    confidence: { eyes: '• •', mouth: '>', label: 'confident' },
    neutral: { eyes: '• •', mouth: '_', label: 'neutral' },
};

// Extended face variations for blended states
const BLENDED_FACES = {
    'joy+mischief': { eyes: '^ <', mouth: 'D', label: 'playful' },
    'joy+attachment': { eyes: '^ ^', mouth: 'u', label: 'loving' },
    'curiosity+joy': { eyes: 'o O', mouth: 'D', label: 'excited' },
    'calm+attachment': { eyes: '- -', mouth: 'u', label: 'content' },
    'fatigue+calm': { eyes: '_ _', mouth: '.', label: 'sleepy' },
    'confidence+mischief': { eyes: '• <', mouth: ')', label: 'smug' },
    'curiosity+confidence': { eyes: 'o •', mouth: '>', label: 'intrigued' },
};

/**
 * Map emotional state vector to a face expression
 * Returns face components and the assembled face string
 */
export function emotionToFace(emotions) {
    // Find dominant emotion
    const sorted = Object.entries(emotions)
        .filter(([key]) => key in FACE_MAP)
        .sort(([, a], [, b]) => b - a);

    if (sorted.length === 0) {
        return {
            face: '• • _ • •',
            eyes: '• •',
            mouth: '_',
            dominant: 'neutral',
            label: 'neutral',
            intensity: 50,
        };
    }

    const [dominant, dominantValue] = sorted[0];
    const [secondary, secondaryValue] = sorted.length > 1 ? sorted[1] : [null, 0];

    // Check for blended face if secondary is strong enough
    if (secondary && secondaryValue > 40 && dominantValue - secondaryValue < 20) {
        const blendKey1 = `${dominant}+${secondary}`;
        const blendKey2 = `${secondary}+${dominant}`;
        const blended = BLENDED_FACES[blendKey1] || BLENDED_FACES[blendKey2];

        if (blended) {
            return {
                face: `${blended.eyes}  ${blended.mouth}`,
                eyes: blended.eyes,
                mouth: blended.mouth,
                dominant,
                secondary,
                label: blended.label,
                intensity: (dominantValue + secondaryValue) / 2,
            };
        }
    }

    // Use dominant emotion face
    const face = FACE_MAP[dominant] || FACE_MAP.neutral;

    return {
        face: `${face.eyes}  ${face.mouth}`,
        eyes: face.eyes,
        mouth: face.mouth,
        dominant,
        label: face.label,
        intensity: dominantValue,
    };
}

/**
 * Get animation parameters for the face
 * Used by the Canvas renderer for smooth transitions
 */
export function getFaceAnimationParams(emotions) {
    const faceData = emotionToFace(emotions);

    return {
        ...faceData,
        // Animation parameters
        blinkRate: emotions.fatigue > 60 ? 0.8 : emotions.curiosity > 60 ? 0.3 : 0.5,
        eyeMovement: emotions.curiosity > 50 ? 0.7 : emotions.calm > 60 ? 0.2 : 0.4,
        mouthMovement: emotions.joy > 60 ? 0.6 : emotions.fatigue > 60 ? 0.1 : 0.3,
        bounceIntensity: emotions.joy > 70 ? 0.5 : emotions.mischief > 60 ? 0.3 : 0.1,
        breathingRate: emotions.calm > 60 ? 0.5 : emotions.fatigue > 60 ? 0.8 : 0.3,
    };
}
