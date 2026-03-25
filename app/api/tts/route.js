import { NextResponse } from 'next/server';

export async function POST(request) {
    try {
        const { text } = await request.json();

        if (!text) {
            return NextResponse.json({ error: 'Text is required' }, { status: 400 });
        }

        // To generate Gemini audio, we use the specific TTS endpoint.
        // Google Cloud TTS currently requires a full GCP service account, but 
        // Gemini's experimental direct TTS is available via internal REST.
        // For standard AI Studio keys, we'll interface with the Google Cloud Text-to-Speech API directly
        // using an API key (if permitted) or fallback to a standard fetch mechanism.

        // Since Google AI Studio keys sometimes lack direct TTS REST access compared to standard language models,
        // we'll build a standard TTS proxy utilizing Google's core speech-to-text API format.

        const url = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${process.env.GEMINI_API_KEY}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                input: {
                    text: text
                },
                voice: {
                    languageCode: 'en-US',
                    name: 'en-US-Journey-F', // Journey voices are Google's ultra-realistic (Gemini-tier) voices
                },
                audioConfig: {
                    audioEncoding: 'MP3',
                    pitch: -1.0,  // Slightly lower pitch for a calmer, less robotic tone
                    speakingRate: 1.05 // Slightly faster, punchy Gen-Z pace
                }
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`TTS API Error: ${response.status} ${errorText}`);
        }

        const data = await response.json();

        // The API returns the audio content as a base64 encoded string
        return NextResponse.json({
            success: true,
            audioContent: data.audioContent
        });

    } catch (error) {
        console.error('TTS Route Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
