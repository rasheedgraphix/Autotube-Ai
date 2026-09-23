# AutoTube AI - YouTube Shorts Automated Pipeline

App is manual-only, no auto schedule.

## Overview
AutoTube AI generates and uploads viral 60-second YouTube Shorts on demand when you click **"GENERATE & UPLOAD NOW"**.

### Manual Pipeline Flow:
1. Queries YouTube Analytics API for the highest CTR topic.
2. Prompts Gemini AI to write viral scripts, 15 SEO tags, and 5 hashtags.
3. Renders 60-second vertical video (Google Veo 3 / FFmpeg + ElevenLabs voiceover + Hormozi bold captions).
4. Auto-uploads directly to connected YouTube channel via OAuth 2.0.

### Configuration
- `GEMINI_API_KEY`: Required for script generation and Veo 3.
- `ELEVENLABS_API_KEY`: Required for human studio voiceover.
- `GOOGLE_CLIENT_ID` & `GOOGLE_CLIENT_SECRET`: For YouTube OAuth integration.
