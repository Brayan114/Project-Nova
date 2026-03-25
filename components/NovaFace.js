'use client';

import { useRef, useEffect, useState } from 'react';

/**
 * NovaFace — Canvas-based animated _._  face
 * Renders eyes and mouth based on emotional state with smooth interpolation
 */
export default function NovaFace({ emotions = {}, size = 160, className = '' }) {
    const canvasRef = useRef(null);
    const animRef = useRef(null);
    const stateRef = useRef({
        leftEye: { x: 0, y: 0, openness: 1, shape: 'circle' },
        rightEye: { x: 0, y: 0, openness: 1, shape: 'circle' },
        mouth: { curve: 0, width: 0.4, openness: 0 },
        blink: 0,
        blinkTimer: 0,
        time: 0,
    });
    const targetRef = useRef({});
    const [faceLabel, setFaceLabel] = useState('neutral');

    // Map emotions to face targets
    useEffect(() => {
        const e = emotions;
        const dominant = getDominant(e);
        setFaceLabel(dominant);

        const target = {};

        switch (dominant) {
            case 'joy':
                target.leftEyeOpenness = 0.3;
                target.rightEyeOpenness = 0.3;
                target.eyeShape = 'arc_up';
                target.mouthCurve = 0.8;
                target.mouthWidth = 0.5;
                target.mouthOpenness = 0.4;
                break;
            case 'curiosity':
                target.leftEyeOpenness = 0.9;
                target.rightEyeOpenness = 1.2;
                target.eyeShape = 'circle';
                target.mouthCurve = 0;
                target.mouthWidth = 0.3;
                target.mouthOpenness = 0.1;
                break;
            case 'mischief':
                target.leftEyeOpenness = 0.6;
                target.rightEyeOpenness = 0.3;
                target.eyeShape = 'squint';
                target.mouthCurve = 0.5;
                target.mouthWidth = 0.4;
                target.mouthOpenness = 0.1;
                break;
            case 'attachment':
                target.leftEyeOpenness = 0.8;
                target.rightEyeOpenness = 0.8;
                target.eyeShape = 'circle';
                target.mouthCurve = 0.3;
                target.mouthWidth = 0.3;
                target.mouthOpenness = 0.2;
                break;
            case 'fatigue':
                target.leftEyeOpenness = 0.2;
                target.rightEyeOpenness = 0.2;
                target.eyeShape = 'line';
                target.mouthCurve = -0.1;
                target.mouthWidth = 0.4;
                target.mouthOpenness = 0;
                break;
            case 'calm':
                target.leftEyeOpenness = 0.4;
                target.rightEyeOpenness = 0.4;
                target.eyeShape = 'line';
                target.mouthCurve = 0.1;
                target.mouthWidth = 0.3;
                target.mouthOpenness = 0;
                break;
            case 'confidence':
                target.leftEyeOpenness = 0.7;
                target.rightEyeOpenness = 0.7;
                target.eyeShape = 'circle';
                target.mouthCurve = 0.4;
                target.mouthWidth = 0.35;
                target.mouthOpenness = 0;
                break;
            default:
                target.leftEyeOpenness = 0.7;
                target.rightEyeOpenness = 0.7;
                target.eyeShape = 'circle';
                target.mouthCurve = 0;
                target.mouthWidth = 0.3;
                target.mouthOpenness = 0;
        }

        targetRef.current = target;
    }, [emotions]);

    // Animation loop
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        canvas.width = size * dpr;
        canvas.height = size * dpr;
        ctx.scale(dpr, dpr);

        function animate() {
            const state = stateRef.current;
            const target = targetRef.current;
            state.time += 0.016;

            // Smooth interpolation toward targets
            const lerp = 0.06;
            state.leftEye.openness += ((target.leftEyeOpenness || 0.7) - state.leftEye.openness) * lerp;
            state.rightEye.openness += ((target.rightEyeOpenness || 0.7) - state.rightEye.openness) * lerp;
            state.mouth.curve += ((target.mouthCurve || 0) - state.mouth.curve) * lerp;
            state.mouth.width += ((target.mouthWidth || 0.3) - state.mouth.width) * lerp;
            state.mouth.openness += ((target.mouthOpenness || 0) - state.mouth.openness) * lerp;

            // Blinking
            state.blinkTimer += 0.016;
            if (state.blinkTimer > 3 + Math.random() * 2) {
                state.blink = 1;
                state.blinkTimer = 0;
            }
            if (state.blink > 0) {
                state.blink -= 0.15;
                if (state.blink < 0) state.blink = 0;
            }

            // Subtle idle movement
            const breathe = Math.sin(state.time * 1.5) * 2;
            const sway = Math.sin(state.time * 0.7) * 1;

            // Clear
            ctx.clearRect(0, 0, size, size);

            const cx = size / 2;
            const cy = size / 2 + breathe;
            const eyeSpacing = size * 0.18;
            const eyeY = cy - size * 0.06;
            const mouthY = cy + size * 0.12;

            // Glow effect
            const glowRadius = size * 0.35;
            const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowRadius);
            grad.addColorStop(0, 'rgba(124, 91, 245, 0.08)');
            grad.addColorStop(1, 'rgba(124, 91, 245, 0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(cx, cy, glowRadius, 0, Math.PI * 2);
            ctx.fill();

            // Draw eyes
            const eyeColor = '#7c5bf5';
            const blinkFactor = 1 - state.blink;

            drawEye(ctx, cx - eyeSpacing + sway, eyeY, state.leftEye.openness * blinkFactor, target.eyeShape, eyeColor, size);
            drawEye(ctx, cx + eyeSpacing + sway, eyeY, state.rightEye.openness * blinkFactor, target.eyeShape, eyeColor, size);

            // Draw mouth
            drawMouth(ctx, cx + sway, mouthY, state.mouth, eyeColor, size);

            animRef.current = requestAnimationFrame(animate);
        }

        animate();

        return () => {
            if (animRef.current) cancelAnimationFrame(animRef.current);
        };
    }, [size]);

    return (
        <div className={`nova-face-container ${className}`}>
            <canvas
                ref={canvasRef}
                className="nova-face-canvas"
                style={{ width: size, height: size }}
            />
            <span className="nova-face-label">{faceLabel}</span>
        </div>
    );
}

function drawEye(ctx, x, y, openness, shape, color, size) {
    const baseSize = size * 0.06;

    ctx.save();
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;

    if (openness < 0.15 || shape === 'line') {
        // Closed/line eye
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x - baseSize, y);
        ctx.lineTo(x + baseSize, y);
        ctx.stroke();
    } else if (shape === 'arc_up') {
        // Happy ^  eye
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(x, y + baseSize * 0.5, baseSize, Math.PI + 0.3, -0.3);
        ctx.stroke();
    } else if (shape === 'squint') {
        // Mischievous > eye
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        const h = baseSize * openness;
        ctx.beginPath();
        ctx.moveTo(x - baseSize, y - h);
        ctx.lineTo(x + baseSize * 0.3, y);
        ctx.lineTo(x - baseSize, y + h);
        ctx.stroke();
    } else {
        // Circle eye
        const radius = baseSize * openness * 0.7;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();

        // Pupil highlight
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.beginPath();
        ctx.arc(x + radius * 0.3, y - radius * 0.3, radius * 0.25, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.restore();
}

function drawMouth(ctx, x, y, mouth, color, size) {
    const mouthWidth = size * mouth.width * 0.5;
    const curve = mouth.curve * size * 0.08;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 6;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';

    if (mouth.openness > 0.15) {
        // Open mouth (D shape for joy, o for attachment)
        ctx.beginPath();
        ctx.moveTo(x - mouthWidth, y);
        ctx.quadraticCurveTo(x, y + curve + mouth.openness * size * 0.1, x + mouthWidth, y);
        ctx.quadraticCurveTo(x, y + curve + mouth.openness * size * 0.2, x - mouthWidth, y);
        ctx.fillStyle = 'rgba(124, 91, 245, 0.3)';
        ctx.fill();
        ctx.stroke();
    } else {
        // Line/curve mouth
        ctx.beginPath();
        ctx.moveTo(x - mouthWidth, y);
        ctx.quadraticCurveTo(x, y + curve, x + mouthWidth, y);
        ctx.stroke();
    }

    ctx.restore();
}

function getDominant(emotions) {
    if (!emotions || Object.keys(emotions).length === 0) return 'neutral';

    const validKeys = ['joy', 'curiosity', 'confidence', 'mischief', 'calm', 'attachment', 'fatigue'];
    let max = 0;
    let dominant = 'neutral';

    for (const key of validKeys) {
        if ((emotions[key] || 0) > max) {
            max = emotions[key];
            dominant = key;
        }
    }

    return dominant;
}
