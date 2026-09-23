import express from "express";
import path from "path";
import fs from "fs";
import os from "os";
import multer from "multer";
import { GoogleGenAI } from "@google/genai";
import { createServer as createViteServer } from "vite";
import { fetchHighestCTRCategory } from "./server/analytics";
import { runDailyAutoPipeline, getPipelineStatus, loadHistory, resetPipeline, publishVideoRunToYouTube } from "./server/pipeline";
import {
  getFfmpegStatus,
  ensureAutotubeDirectory,
  ensureFontconfigCache,
  getVerifiedFontPath,
  AUTOTUBE_TMP_DIR,
  SYSTEM_FFMPEG_PATH,
} from "./server/ffmpegHelper";
import {
  savePersistedToken,
  loadPersistedToken,
  clearPersistedToken,
} from "./server/tokenStorage";
import {
  startVeoGeneration,
  checkVeoStatus,
  downloadVeoVideoBuffer,
  generateVeoSceneVideo,
} from "./server/veoService";
import { generateSpeechVoice, DOCUMENTARY_VOICES } from "./server/elevenLabsService";
import { getTrendingCricketMatches } from "./server/cricketService";
import { inspectHighlightLink } from "./server/cricketHighlightService";
import { getRealTimeTrendingTopics, evaluateCTRScore } from "./server/seoOptimizer";
import { getRealTimeYouTubeStudioAnalytics } from "./server/youtubeStudioService";

// Initialize multer for handling MP4 video files in memory (up to 250MB for free/simple tier)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 250 * 1024 * 1024, // 250MB limit
  },
});

// Restore token from persistent storage (/tmp/autotube/token.json or data/token.json)
const initialPersisted = loadPersistedToken();
let currentOAuthToken: string | null = initialPersisted.token;
let currentChannelData: any = initialPersisted.channel;
if (currentOAuthToken) {
  console.log(`[TokenStorage] Restored OAuth token from persistent storage on boot (${currentChannelData?.title || "connected"}).`);
}

// Helper to resolve the Gemini API key from any configured environment variable
export function getResolvedGeminiApiKey(customKey?: string | null): string | undefined {
  return (
    customKey ||
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.CUSTOM_GEMINI_API_KEY ||
    process.env.GEMINI_KEY ||
    process.env.API_KEY ||
    undefined
  );
}

// Initialize Google Gemini AI client
function getGeminiClient(): GoogleGenAI {
  const apiKey = getResolvedGeminiApiKey();
  if (!apiKey) {
    throw new Error("Gemini API key is missing. Please set GOOGLE_API_KEY or CUSTOM_GEMINI_API_KEY in Settings.");
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

async function startServer() {
  // Ensure /tmp/autotube exists with chmod 777
  ensureAutotubeDirectory();

  // Ensure fontconfig cache is refreshed
  ensureFontconfigCache();

  // Verify font file exists
  let verifiedFont: string | null = null;
  try {
    verifiedFont = getVerifiedFontPath();
    console.log(`[Font] Verified font loaded: ${verifiedFont}`);
  } catch (fontErr: any) {
    console.warn(`[Font Warning] ${fontErr.message}`);
  }

  // Check FFmpeg availability - log warning only in preview mode, no blocking critical error
  const ffmpegStatus = getFfmpegStatus();
  if (!ffmpegStatus.available) {
    console.warn(`[FFmpeg Info] Status: Preview Mode - FFmpeg will be available after deploy.`);
  } else {
    console.log(`[FFmpeg] Explicit System FFmpeg in use: ${ffmpegStatus.binaryPath} (${ffmpegStatus.version || "detected"})`);
  }
  console.log(`[Storage] Working directory /tmp/autotube initialized with chmod 777.`);

  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "25mb" }));
  app.use(express.urlencoded({ extended: true, limit: "25mb" }));

  // Health check - returns engine statuses (Veo 3, ElevenLabs, Gemini, FFmpeg)
  app.get("/api/health", (_req, res) => {
    const currentFfmpeg = getFfmpegStatus();
    const persisted = loadPersistedToken();
    const effectiveToken = currentOAuthToken || persisted.token;
    let fontOk = false;
    try {
      getVerifiedFontPath();
      fontOk = true;
    } catch {}

    res.json({
      status: "ok",
      hasGeminiKey: Boolean(getResolvedGeminiApiKey()),
      hasElevenLabsKey: Boolean(process.env.ELEVENLABS_API_KEY),
      hasGoogleClientId: Boolean(process.env.GOOGLE_CLIENT_ID),
      hasConnectedToken: Boolean(effectiveToken),
      hasFfmpeg: currentFfmpeg.available,
      veo3Model: "veo-3.1-generate-preview",
      elevenLabsVoiceId: process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM",
      ffmpegMode: currentFfmpeg.available ? "active" : "preview-mode",
      ffmpegWarning: currentFfmpeg.available ? null : "Preview Mode: FFmpeg will be available after deploy",
      ffmpegBinary: currentFfmpeg.binaryPath,
      ffmpegVersion: currentFfmpeg.version || null,
      ffmpegSource: currentFfmpeg.source,
      hasFont: fontOk,
      fontPath: verifiedFont,
      fontconfigPath: process.env.FONTCONFIG_PATH || "/etc/fonts",
      storagePath: AUTOTUBE_TMP_DIR,
    });
  });

  // 1b. GOOGLE VEO 3: Generate 4K AI Video
  // Prompt default: "Ancient Islamic library, Al-Zahrawi writing medical book, cinematic, 4k"
  app.post("/api/veo/generate", async (req, res) => {
    try {
      const { prompt, resolution, aspectRatio, model } = req.body || {};
      const effectivePrompt = prompt || "Ancient Islamic library, Al-Zahrawi writing medical book, cinematic, 4k";

      const { operationName } = await startVeoGeneration(
        effectivePrompt,
        process.env.GEMINI_API_KEY,
        {
          resolution: resolution || "1080p",
          aspectRatio: aspectRatio || "9:16",
          model: model || "veo-3.1-generate-preview",
        }
      );

      return res.json({
        success: true,
        operationName,
        prompt: effectivePrompt,
        message: "Google Veo 3 video generation initiated. Use operationName to poll status.",
      });
    } catch (err: any) {
      console.error("Google Veo 3 generation error:", err);
      return res.status(500).json({
        error: err.message || "Failed to start Google Veo 3 video generation.",
      });
    }
  });

  // 1c. GOOGLE VEO 3: Check Generation Status
  app.post("/api/veo/status", async (req, res) => {
    try {
      const { operationName } = req.body;
      if (!operationName) {
        return res.status(400).json({ error: "operationName is required." });
      }

      const status = await checkVeoStatus(operationName, process.env.GEMINI_API_KEY);
      return res.json({
        success: true,
        ...status,
      });
    } catch (err: any) {
      console.error("Google Veo 3 status check error:", err);
      return res.status(500).json({
        error: err.message || "Failed to check Google Veo 3 status.",
      });
    }
  });

  // 1d. ELEVENLABS: Synthesize Human Voiceover
  app.post("/api/voice/generate", async (req, res) => {
    try {
      const { text, voiceId } = req.body;
      if (!text || typeof text !== "string" || !text.trim()) {
        return res.status(400).json({ error: "Text is required for voiceover generation." });
      }

      const tmpAudioPath = path.join(AUTOTUBE_TMP_DIR, `voice_test_${Date.now()}.mp3`);
      const result = await generateSpeechVoice(text, tmpAudioPath, {
        voiceId,
        apiKey: process.env.ELEVENLABS_API_KEY,
      });

      if (result.success && result.filePath && fs.existsSync(result.filePath)) {
        const audioBuffer = fs.readFileSync(result.filePath);
        res.writeHead(200, {
          "Content-Type": "audio/mpeg",
          "Content-Length": audioBuffer.length,
          "X-Voice-Engine": result.source,
        });
        return res.end(audioBuffer);
      }

      return res.status(500).json({ error: result.error || "Voice generation failed." });
    } catch (err: any) {
      console.error("Voice generation error:", err);
      return res.status(500).json({ error: err.message || "Voice generation failed." });
    }
  });

  // 1. BRAIN: Generate SEO Video Metadata via Gemini
  app.post("/api/gemini/generate", async (req, res) => {
    try {
      const { niche } = req.body;
      if (!niche || typeof niche !== "string" || !niche.trim()) {
        return res.status(400).json({ error: "Please provide your channel niche." });
      }

      const ai = getGeminiClient();

      const prompt = `You are a world-class YouTube SEO expert and viral video producer.
A YouTube creator has a channel in the following niche: "${niche.trim()}".

Generate viral video metadata tailored for this niche with the following strict rules:
1. Title: Extremely catchy, click-worthy, SEO friendly, and STRICTLY UNDER 70 characters (counting all spaces and punctuation).
2. Description: Around 300 words, rich with high-volume search keywords. Naturally written with engaging intro, key takeaways, and a call-to-action to subscribe. Use the appropriate language for the niche (for example, if Islamic Education or Pakistani/Urdu-related topic, use a natural Urdu / English bilingual mix or Roman Urdu/English mix as popular on YouTube; otherwise appropriate professional language).
3. Tags: An array of exactly 15 SEO tags (keyword phrases without '#' symbol, highly relevant to search algorithms).
4. Hashtags: An array of exactly 5 trending hashtags starting with '#' (e.g. #IslamicEducation, #Viral).

Respond ONLY with a valid JSON object in this exact schema:
{
  "title": "...",
  "description": "...",
  "tags": ["tag1", "tag2", ..., "tag15"],
  "hashtags": ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5"]
}`;

      // Use resilient model cascade (gemini-2.5-flash as primary, gemini-3.8-flash, gemini-3.1-flash-lite)
      const candidateModels = ["gemini-2.5-flash", "gemini-3.8-flash", "gemini-3.1-flash-lite"];
      let rawText = "";
      let lastError = null;

      for (const model of candidateModels) {
        try {
          const response = await ai.models.generateContent({
            model,
            contents: prompt,
            config: {
              responseMimeType: "application/json",
              temperature: 0.7,
            },
          });
          if (response.text) {
            rawText = response.text;
            break;
          }
        } catch (mErr) {
          lastError = mErr;
          console.warn(`Model ${model} failed, trying next fallback...`, mErr);
        }
      }

      if (!rawText) {
        throw lastError || new Error("All Gemini models failed to generate content.");
      }

      let parsedData: any = {};
      try {
        parsedData = JSON.parse(rawText);
      } catch (parseError) {
        const cleaned = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
        parsedData = JSON.parse(cleaned);
      }

      // 1. Validate title length constraint (strictly under 70 chars)
      let finalTitle = (parsedData.title || "").trim();
      if (finalTitle.length > 70) {
        finalTitle = finalTitle.slice(0, 67).trim() + "...";
      }
      parsedData.title = finalTitle;

      // 2. Normalize tags to 15 items
      if (!Array.isArray(parsedData.tags)) {
        parsedData.tags = typeof parsedData.tags === "string" ? parsedData.tags.split(",").map((s: string) => s.trim()) : [];
      }
      parsedData.tags = parsedData.tags.map((t: any) => String(t).replace(/^#/, "").trim()).filter(Boolean).slice(0, 15);

      // 3. Normalize hashtags to 5 items with '#'
      if (!Array.isArray(parsedData.hashtags)) {
        parsedData.hashtags = typeof parsedData.hashtags === "string" ? parsedData.hashtags.split(/\s+/).map((s: string) => s.trim()) : [];
      }
      parsedData.hashtags = parsedData.hashtags
        .map((h: any) => {
          const str = String(h).trim();
          return str.startsWith("#") ? str : `#${str}`;
        })
        .filter(Boolean)
        .slice(0, 5);

      return res.json({
        success: true,
        data: parsedData,
      });
    } catch (err: any) {
      console.error("Gemini generation error:", err);
      return res.status(500).json({
        error: err.message || "Failed to generate video metadata with Gemini.",
      });
    }
  });

  // 2. OAUTH: Construct Google OAuth 2.0 Authorization URL
  app.get("/api/auth/google/url", (req, res) => {
    try {
      const clientId = (req.query.clientId as string) || process.env.GOOGLE_CLIENT_ID;
      if (!clientId) {
        return res.status(400).json({
          error: "GOOGLE_CLIENT_ID is not configured. Please provide your Google Client ID.",
        });
      }

      const host = req.get("host");
      const protocol = req.protocol === "https" || req.headers["x-forwarded-proto"] === "https" ? "https" : "http";
      const redirectUri = `${protocol}://${host}/auth/callback`;

      const scopes = [
        "https://www.googleapis.com/auth/youtube.upload",
        "https://www.googleapis.com/auth/youtube.readonly",
        "https://www.googleapis.com/auth/userinfo.profile",
      ].join(" ");

      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: scopes,
        access_type: "offline",
        prompt: "consent",
        include_granted_scopes: "true",
      });

      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
      res.json({ url: authUrl, redirectUri });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 3. OAUTH: Callback handler with postMessage cross-origin popup support
  const callbackHandler = async (req: express.Request, res: express.Response) => {
    const { code, error } = req.query;

    if (error) {
      return res.send(`
        <!DOCTYPE html>
        <html>
          <body style="font-family: sans-serif; padding: 40px; text-align: center;">
            <h2 style="color: #ef4444;">Authentication Failed</h2>
            <p>${String(error)}</p>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'OAUTH_AUTH_ERROR', error: '${String(error)}' }, '*');
                setTimeout(() => window.close(), 2500);
              }
            </script>
          </body>
        </html>
      `);
    }

    if (!code) {
      return res.status(400).send("No authorization code received.");
    }

    try {
      const clientId = process.env.GOOGLE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

      if (!clientId || !clientSecret) {
        return res.status(500).send("Server missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET environment variables.");
      }

      const host = req.get("host");
      const protocol = req.protocol === "https" || req.headers["x-forwarded-proto"] === "https" ? "https" : "http";
      const redirectUri = `${protocol}://${host}/auth/callback`;

      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code: String(code),
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }),
      });

      const tokenData = await tokenRes.json();
      if (!tokenRes.ok || !tokenData.access_token) {
        throw new Error(tokenData.error_description || tokenData.error || "Token exchange failed");
      }

      const accessToken = tokenData.access_token;
      currentOAuthToken = accessToken;

      // Fetch channel information
      let channel = null;
      try {
        const channelRes = await fetch(
          "https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true",
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );
        const channelData = await channelRes.json();
        if (channelData.items && channelData.items.length > 0) {
          const item = channelData.items[0];
          channel = {
            id: item.id,
            title: item.snippet.title,
            customUrl: item.snippet.customUrl,
            thumbnail: item.snippet.thumbnails?.default?.url || item.snippet.thumbnails?.medium?.url,
            subscriberCount: item.statistics?.subscriberCount,
            videoCount: item.statistics?.videoCount,
          };
          currentChannelData = channel;
        }
      } catch (chErr) {
        console.warn("Could not fetch channel details:", chErr);
      }

      // Persist token immediately to disk (/tmp/autotube/token.json & data/token.json)
      savePersistedToken({ token: accessToken, channel });

      // Return popup closer with postMessage
      res.send(`
        <!DOCTYPE html>
        <html>
          <head><title>YouTube Connected</title></head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background-color: #0f172a; color: #f8fafc;">
            <div style="text-align: center; padding: 32px; background: #1e293b; border-radius: 12px; max-width: 400px; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
              <div style="width: 56px; height: 56px; margin: 0 auto 16px; background: #22c55e; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
              </div>
              <h2 style="margin: 0 0 8px; font-size: 20px;">Channel Connected!</h2>
              <p style="color: #94a3b8; font-size: 14px; margin: 0 0 16px;">${channel?.title ? `Connected to <b>${channel.title}</b>` : "Your YouTube channel is authenticated."}</p>
              <p style="color: #64748b; font-size: 12px;">This popup will close automatically...</p>
            </div>
            <script>
              const payload = {
                type: 'OAUTH_AUTH_SUCCESS',
                accessToken: '${accessToken}',
                channel: ${JSON.stringify(channel)}
              };
              if (window.opener) {
                window.opener.postMessage(payload, '*');
                setTimeout(() => { window.close(); }, 1200);
              } else {
                window.location.href = '/';
              }
            </script>
          </body>
        </html>
      `);
    } catch (err: any) {
      console.error("OAuth callback error:", err);
      res.status(500).send(`Authentication error: ${err.message}`);
    }
  };

  app.get(["/auth/callback", "/auth/callback/"], callbackHandler);

  // 4. Check or Set OAuth Token directly (supports simple token input or OAuth popup)
  app.get("/api/auth/status", async (req, res) => {
    const persisted = loadPersistedToken();
    const token = req.headers.authorization?.replace("Bearer ", "") || currentOAuthToken || persisted.token;
    if (!token) {
      return res.json({ connected: false });
    }

    try {
      const channelRes = await fetch(
        "https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true",
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const data = await channelRes.json();
      if (!channelRes.ok || !data.items || data.items.length === 0) {
        // If expired, clear persisted token
        clearPersistedToken();
        currentOAuthToken = null;
        currentChannelData = null;
        return res.json({ connected: false, error: data.error?.message || "Channel not found or token expired" });
      }

      const item = data.items[0];
      const channel = {
        id: item.id,
        title: item.snippet.title,
        customUrl: item.snippet.customUrl,
        thumbnail: item.snippet.thumbnails?.default?.url || item.snippet.thumbnails?.medium?.url,
        subscriberCount: item.statistics?.subscriberCount,
        viewCount: item.statistics?.viewCount,
        videoCount: item.statistics?.videoCount,
      };

      currentOAuthToken = token;
      currentChannelData = channel;
      savePersistedToken({ token, channel });

      return res.json({
        connected: true,
        channel,
        token,
      });
    } catch (err: any) {
      return res.json({ connected: false, error: err.message });
    }
  });

  // 5. Connect via Access Token manually (keep auth simple as user requested: "I will only use it for my own channel, so keep auth simple")
  app.post("/api/auth/connect-token", async (req, res) => {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ error: "Access token is required" });
    }

    try {
      const channelRes = await fetch(
        "https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true",
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const data = await channelRes.json();
      if (!channelRes.ok || !data.items || data.items.length === 0) {
        return res.status(400).json({
          error: data.error?.message || "Invalid Google Access Token or no YouTube channel found for this account.",
        });
      }

      const item = data.items[0];
      const channel = {
        id: item.id,
        title: item.snippet.title,
        customUrl: item.snippet.customUrl,
        thumbnail: item.snippet.thumbnails?.default?.url || item.snippet.thumbnails?.medium?.url,
        subscriberCount: item.statistics?.subscriberCount,
        viewCount: item.statistics?.viewCount,
        videoCount: item.statistics?.videoCount,
      };

      currentOAuthToken = token;
      currentChannelData = channel;
      savePersistedToken({ token, channel });

      return res.json({
        success: true,
        channel,
        token,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // 5b. Save Token directly from Frontend LocalStorage / App State
  app.post("/api/auth/save-token", async (req, res) => {
    const { token, channel } = req.body;
    if (!token) {
      return res.status(400).json({ error: "Access token is required" });
    }

    currentOAuthToken = token;
    if (channel) {
      currentChannelData = channel;
    }
    savePersistedToken({ token, channel: currentChannelData });

    return res.json({
      success: true,
      token,
      channel: currentChannelData,
      message: "Token persisted successfully to /tmp/autotube/token.json",
    });
  });

  // 6. Disconnect channel
  app.post("/api/auth/disconnect", (_req, res) => {
    currentOAuthToken = null;
    currentChannelData = null;
    clearPersistedToken();
    res.json({ success: true });
  });

  // 7. UPLOADER: YouTube Data API v3 Video Upload
  // Logic matches the requested Python implementation:
  // youtube.videos().insert(
  //   part="snippet,status",
  //   body={
  //     "snippet": {"title": title, "description": description, "tags": tags, "categoryId": "27"},
  //     "status": {"privacyStatus": "public", "selfDeclaredMadeForKids": False}
  //   },
  //   media_body=file_path
  // ).execute()
  app.post("/api/youtube/upload", upload.single("video"), async (req, res) => {
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({ error: "No video file uploaded. Please select an MP4 file." });
      }

      const { title, description, tags, hashtags, privacyStatus } = req.body;
      const token = req.headers.authorization?.replace("Bearer ", "") || currentOAuthToken;

      if (!token) {
        return res.status(401).json({
          error: "YouTube channel not connected. Please connect your YouTube channel first.",
        });
      }

      if (!title || !title.trim()) {
        return res.status(400).json({ error: "Video title is required." });
      }

      // Parse tags
      let parsedTags: string[] = [];
      if (typeof tags === "string") {
        try {
          const jsonTags = JSON.parse(tags);
          parsedTags = Array.isArray(jsonTags) ? jsonTags : tags.split(",").map((t) => t.trim());
        } catch {
          parsedTags = tags.split(",").map((t) => t.trim()).filter(Boolean);
        }
      } else if (Array.isArray(tags)) {
        parsedTags = tags;
      }

      // Append hashtags to description if present
      let fullDescription = description || "";
      if (hashtags) {
        let tagList: string[] = [];
        if (typeof hashtags === "string") {
          try {
            const parsed = JSON.parse(hashtags);
            tagList = Array.isArray(parsed) ? parsed : hashtags.split(/\s+/);
          } catch {
            tagList = hashtags.split(/\s+/);
          }
        } else if (Array.isArray(hashtags)) {
          tagList = hashtags;
        }
        const tagStr = tagList.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ");
        if (!fullDescription.includes(tagStr)) {
          fullDescription = `${fullDescription.trim()}\n\n${tagStr}`;
        }
      }

      // Metadata object matching requested Python API parameters
      const metadata = {
        snippet: {
          title: title.trim(),
          description: fullDescription.trim(),
          tags: parsedTags,
          categoryId: "27", // Education category as requested
        },
        status: {
          privacyStatus: privacyStatus || "public", // Defaults to public as requested
          selfDeclaredMadeForKids: false,
        },
      };

      console.log(`Starting YouTube Resumable Upload: "${metadata.snippet.title}" (${file.size} bytes)...`);

      // Step 1: Initiate Resumable Upload Session with YouTube API
      const initResponse = await fetch(
        "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json; charset=UTF-8",
            "X-Upload-Content-Type": file.mimetype || "video/mp4",
            "X-Upload-Content-Length": String(file.size),
          },
          body: JSON.stringify(metadata),
        }
      );

      if (!initResponse.ok) {
        const errBody = await initResponse.text();
        console.error("YouTube upload initiation failed:", initResponse.status, errBody);
        let msg = "Failed to initiate YouTube upload.";
        try {
          const parsedErr = JSON.parse(errBody);
          msg = parsedErr.error?.message || msg;
        } catch {
          msg = errBody || msg;
        }
        return res.status(initResponse.status).json({ error: msg });
      }

      const uploadLocation = initResponse.headers.get("location");
      if (!uploadLocation) {
        return res.status(500).json({ error: "YouTube API did not return an upload session URL." });
      }

      // Step 2: Upload the actual binary video buffer to the session location
      const uploadResponse = await fetch(uploadLocation, {
        method: "PUT",
        headers: {
          "Content-Type": file.mimetype || "video/mp4",
          "Content-Length": String(file.size),
        },
        body: file.buffer,
      });

      if (!uploadResponse.ok) {
        const uploadErrBody = await uploadResponse.text();
        console.error("YouTube video binary upload failed:", uploadResponse.status, uploadErrBody);
        let msg = "Failed to upload video content to YouTube.";
        try {
          const parsed = JSON.parse(uploadErrBody);
          msg = parsed.error?.message || msg;
        } catch {
          msg = uploadErrBody || msg;
        }
        return res.status(uploadResponse.status).json({ error: msg });
      }

      const uploadResult = await uploadResponse.json();
      const videoId = uploadResult.id;
      const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
      const embedUrl = `https://www.youtube.com/embed/${videoId}`;

      console.log(`YouTube upload successful! Video URL: ${videoUrl}`);

      return res.json({
        success: true,
        videoId,
        videoUrl,
        embedUrl,
        data: uploadResult,
      });
    } catch (err: any) {
      console.error("Upload handler error:", err);
      return res.status(500).json({ error: err.message || "An unexpected error occurred during upload." });
    }
  });

  // 8. SCHEDULER & ANALYTICS API: Highest CTR Categories
  app.get("/api/analytics/categories", async (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "") || currentOAuthToken;
      const result = await fetchHighestCTRCategory(token);
      return res.json({ success: true, data: result });
    } catch (err: any) {
      console.error("Analytics fetch error:", err);
      return res.status(500).json({ error: err.message || "Failed to fetch analytics." });
    }
  });

  // 9. SCHEDULER: Get Daily Pipeline Status (Manual Trigger Mode)
  app.get("/api/scheduler/status", (_req, res) => {
    try {
      const status = getPipelineStatus();
      const persistedTokenInfo = loadPersistedToken();
      const effectiveToken = currentOAuthToken || persistedTokenInfo.token;
      const effectiveChannelTitle = currentChannelData?.title || persistedTokenInfo.channel?.title || null;

      return res.json({
        success: true,
        scheduler: {
          mode: "manual",
          active: false,
          autoSchedule: false,
          scheduleDescription: "Manual Trigger Only (No automated background cron schedule)",
          hasConnectedChannel: Boolean(effectiveToken),
          connectedChannelTitle: effectiveChannelTitle,
          httpEndpoint: "/api/scheduler/daily-run",
        },
        pipeline: status,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // 10. MANUAL TRIGGER: Run Pipeline (Gemini script -> Shorts or 8+ min Long Video -> YouTube upload)
  app.post("/api/scheduler/daily-run", async (req, res) => {
    try {
      const persisted = loadPersistedToken();
      const authHeader = req.headers.authorization?.replace("Bearer ", "");
      const token = authHeader || req.body?.oauthToken || currentOAuthToken || persisted.token;
      const { privacyStatus, overrideNiche, categoryId, videoFormat, voiceId, languageStyle, customPrompt, targetDurationMinutes } = req.body || {};

      if (token && token !== persisted.token) {
        currentOAuthToken = token;
        savePersistedToken({ token, channel: currentChannelData });
      }

      console.log(
        `[Manual Pipeline Run Triggered] Format: ${videoFormat || "short"} | Custom Prompt: ${Boolean(customPrompt)} | Minutes: ${targetDurationMinutes || "default"} | Starting pipeline... (Channel connected: ${Boolean(token)}) | Voice: ${voiceId || "auto"}`
      );

      const currentStatus = getPipelineStatus();
      if (currentStatus.isRunning) {
        return res.json({
          success: true,
          started: false,
          isRunning: true,
          message: "Pipeline is already running in background.",
          pipeline: currentStatus,
        });
      }

      // Launch pipeline asynchronously
      const pipelinePromise = runDailyAutoPipeline(token, getResolvedGeminiApiKey(), {
        privacyStatus: privacyStatus || "public",
        overrideNiche,
        categoryId,
        videoFormat: videoFormat === "long" ? "long" : "short",
        voiceId,
        languageStyle,
        customPrompt,
        targetDurationMinutes: typeof targetDurationMinutes === "number" ? targetDurationMinutes : undefined,
      });

      pipelinePromise.catch((err) => {
        console.error("[DailyAutoPipeline Execution Error]", err);
      });

      return res.json({
        success: true,
        started: true,
        isRunning: true,
        message: `AutoTube AI ${videoFormat === "long" ? "1080p Documentary" : "60s Short"} pipeline started successfully!`,
      });
    } catch (err: any) {
      console.error("Pipeline execution trigger error:", err);
      return res.status(500).json({
        success: false,
        error: err.message || "Failed to trigger automated pipeline.",
      });
    }
  });

  // CANCEL / RESET ACTIVE PIPELINE
  app.post("/api/pipeline/reset", (_req, res) => {
    try {
      const result = resetPipeline();
      return res.json({ success: true, message: "Pipeline reset successfully.", ...result });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post("/api/scheduler/cancel", (_req, res) => {
    try {
      const result = resetPipeline();
      return res.json({ success: true, message: "Pipeline stopped and reset.", ...result });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // 11. SCHEDULER: Stream/Preview generated video file with full HTTP Range (206) seeking support
  app.get("/api/scheduler/video-preview/:runId", (req, res) => {
    try {
      const { runId } = req.params;
      const workspacePath = path.join(process.cwd(), "data", "previews", `${runId}.mp4`);
      const primaryPath = path.join(AUTOTUBE_TMP_DIR, "previews", `${runId}.mp4`);
      const fallbackPath = path.join(os.tmpdir(), "autotube_previews", `${runId}.mp4`);
      const videoPath = fs.existsSync(workspacePath)
        ? workspacePath
        : fs.existsSync(primaryPath)
        ? primaryPath
        : fallbackPath;

      if (!fs.existsSync(videoPath)) {
        return res.status(404).send("Video not found or expired.");
      }

      const stat = fs.statSync(videoPath);
      const fileSize = stat.size;
      const range = req.headers.range;

      if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

        if (start >= fileSize || end >= fileSize) {
          res.writeHead(416, {
            "Content-Range": `bytes */${fileSize}`,
          });
          return res.end();
        }

        const chunksize = end - start + 1;
        const fileStream = fs.createReadStream(videoPath, { start, end });
        const headers = {
          "Content-Range": `bytes ${start}-${end}/${fileSize}`,
          "Accept-Ranges": "bytes",
          "Content-Length": chunksize,
          "Content-Type": "video/mp4",
        };

        res.writeHead(206, headers);
        fileStream.pipe(res);
      } else {
        const headers = {
          "Content-Length": fileSize,
          "Accept-Ranges": "bytes",
          "Content-Type": "video/mp4",
        };
        res.writeHead(200, headers);
        fs.createReadStream(videoPath).pipe(res);
      }
    } catch (err: any) {
      res.status(500).send("Error reading video stream.");
    }
  });

  // 11b. THUMBNAIL: Stream/Preview generated bespoke high-CTR thumbnail
  app.get("/api/scheduler/thumbnail-preview/:runId", (req, res) => {
    try {
      const { runId } = req.params;
      const workspacePath = path.join(process.cwd(), "data", "thumbnails", `${runId}.jpg`);
      const thumbPath = fs.existsSync(workspacePath)
        ? workspacePath
        : path.join(AUTOTUBE_TMP_DIR, "thumbnails", `${runId}.jpg`);

      if (!fs.existsSync(thumbPath)) {
        return res.status(404).send("Thumbnail not found or expired.");
      }

      const stat = fs.statSync(thumbPath);
      res.writeHead(200, {
        "Content-Type": "image/jpeg",
        "Content-Length": stat.size,
        "Cache-Control": "public, max-age=86400",
      });

      const readStream = fs.createReadStream(thumbPath);
      readStream.pipe(res);
    } catch (err: any) {
      res.status(500).send("Error reading thumbnail.");
    }
  });

  // 11c. THUMBNAIL: Force download high-resolution thumbnail
  app.get("/api/scheduler/thumbnail-download/:runId", (req, res) => {
    try {
      const { runId } = req.params;
      const thumbPath = path.join(AUTOTUBE_TMP_DIR, "thumbnails", `${runId}.jpg`);

      if (!fs.existsSync(thumbPath)) {
        return res.status(404).send("Thumbnail not found.");
      }

      res.download(thumbPath, `${runId}_thumbnail.jpg`);
    } catch (err: any) {
      res.status(500).send("Error downloading thumbnail.");
    }
  });

  // 11d. SEO INTELLIGENCE: Today's Real-Time Trends & Verified CTR Benchmarks ("Aaj kya chal raha hai, kis ka CTR zyada hai")
  app.get("/api/seo/realtime-trends", (req, res) => {
    try {
      const trends = getRealTimeTrendingTopics();
      const todayDate = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
      return res.json({
        success: true,
        todayDate,
        totalTrends: trends.length,
        trends,
        verificationStatus: "Verified Live Match & Search Trends Active",
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || "Failed to fetch real-time trends." });
    }
  });

  // 11e. SEO INTELLIGENCE: Evaluate CTR Score for any title / topic
  app.post("/api/seo/evaluate-ctr", (req, res) => {
    try {
      const { title, niche, isShort } = req.body;
      if (!title || typeof title !== "string") {
        return res.status(400).json({ error: "Title is required for CTR evaluation." });
      }

      const analysis = evaluateCTRScore(title, niche || "Cricket Highlights", Boolean(isShort));
      return res.json({
        success: true,
        title,
        analysis,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || "Failed to evaluate CTR score." });
    }
  });

  // 12. CRICKET STUDIO: Fetch Today's / Recent Matches & Trending News
  app.get("/api/cricket/matches", async (req, res) => {
    try {
      const query = typeof req.query.q === "string" ? req.query.q : undefined;
      const matches = await getTrendingCricketMatches(getResolvedGeminiApiKey(), query);
      return res.json({ success: true, matches });
    } catch (err: any) {
      console.error("Cricket matches fetch error:", err);
      return res.status(500).json({ error: err.message || "Failed to fetch cricket matches." });
    }
  });

  // 12b. YOUTUBE STUDIO: Real-Time Official Channel Analytics (Views, Subscribers, Watch Time, Uploaded Videos)
  app.get("/api/studio/analytics", async (req, res) => {
    try {
      const persisted = loadPersistedToken();
      const authHeader = req.headers.authorization?.replace("Bearer ", "");
      const token = authHeader || (req.query.token as string) || currentOAuthToken || persisted.token;

      if (!token || !token.trim()) {
        return res.json({
          success: true,
          data: {
            connected: false,
            message: "No YouTube Channel connected. Please connect your YouTube account via Google OAuth or Access Token to view real-time statistics.",
            channel: null,
            overview: null,
            recentVideos: [],
            performanceSummary: null,
          },
        });
      }

      const analytics = await getRealTimeYouTubeStudioAnalytics(token);

      if (analytics.connected && analytics.channel) {
        currentChannelData = analytics.channel;
        currentOAuthToken = token;
        savePersistedToken({ token, channel: analytics.channel });
      } else if (analytics.tokenExpired) {
        // Clear expired session so user can reconnect
        clearPersistedToken();
        currentOAuthToken = null;
        currentChannelData = null;
      }

      return res.json({ success: true, data: analytics });
    } catch (err: any) {
      console.error("Studio analytics error:", err);
      return res.status(500).json({ error: err.message || "Failed to load studio analytics." });
    }
  });

  // 13. CRICKET STUDIO: Trigger Match Documentary Generation (Supports 1 to 3 Match Highlight Links with 5s Clip Extraction)
  app.post("/api/cricket/generate-documentary", async (req, res) => {
    try {
      const persisted = loadPersistedToken();
      const authHeader = req.headers.authorization?.replace("Bearer ", "");
      const token = authHeader || req.body?.oauthToken || currentOAuthToken || persisted.token;
      const {
        match,
        videoFormat,
        languageStyle,
        privacyStatus,
        voiceId,
        highlightUrls,
        filterMode,
        targetPlayerName,
        bgmStyle,
        copyrightShield,
        autoUpload,
      } = req.body || {};

      if (token && token !== persisted.token) {
        currentOAuthToken = token;
        savePersistedToken({ token, channel: currentChannelData });
      }

      const currentStatus = getPipelineStatus();
      if (currentStatus.isRunning) {
        return res.json({
          success: true,
          started: false,
          isRunning: true,
          message: "A video pipeline is already running in the background. Please wait for it to finish.",
          pipeline: currentStatus,
        });
      }

      // Collect highlight links (from explicit highlightUrls, match.highlightUrls, or match.suggestedHighlightLinks)
      const collectedHighlightUrls: string[] = Array.isArray(highlightUrls)
        ? highlightUrls
        : Array.isArray(match?.highlightUrls)
        ? match.highlightUrls
        : Array.isArray(match?.suggestedHighlightLinks)
        ? match.suggestedHighlightLinks
        : [];

      const cleanHighlightUrls = collectedHighlightUrls
        .map((u) => (typeof u === "string" ? u.trim() : ""))
        .filter(Boolean)
        .slice(0, 3); // Max 3 links as requested

      // By user directive ("sirf cricket ki video jab ban jaye to seeda upload na ho pehle deko phir upload"):
      // For cricket videos, default autoUpload to false unless explicitly instructed otherwise
      const shouldAutoUpload = autoUpload === true;

      console.log(
        `[Cricket Generation Triggered] Match: "${match?.matchTitle || "Match Highlights"}" | AutoUpload: ${shouldAutoUpload} | Filter: ${filterMode || "full_match_highlights"} | Player: ${targetPlayerName || "none"} | BGM: ${bgmStyle || "default"} | Shield: ${copyrightShield !== false} | Highlights: ${cleanHighlightUrls.length} link(s) | Format: ${videoFormat || "short"} | Language: ${languageStyle || "urdu_hindi"} | Voice: ${voiceId || "auto"}`
      );

      const pipelinePromise = runDailyAutoPipeline(token, getResolvedGeminiApiKey(), {
        privacyStatus: privacyStatus || "public",
        categoryId: "cricket-match-doc",
        overrideNiche: match?.matchTitle ? `Cricket: ${match.matchTitle}` : "Cricket Match Highlights & 5s Video Breakdown",
        videoFormat: videoFormat === "long" ? "long" : "short",
        cricketMatchDetails: match,
        languageStyle: languageStyle || "urdu_hindi",
        voiceId,
        highlightUrls: cleanHighlightUrls.length > 0 ? cleanHighlightUrls : undefined,
        filterMode: filterMode || "full_match_highlights",
        targetPlayerName: targetPlayerName || undefined,
        bgmStyle: bgmStyle || "high_energy_phonk",
        copyrightShield: copyrightShield !== false,
        autoUpload: shouldAutoUpload,
      });

      pipelinePromise.catch((err) => {
        console.error("[CricketDocumentary Execution Error]", err);
      });

      return res.json({
        success: true,
        started: true,
        isRunning: true,
        message: cleanHighlightUrls.length > 0
          ? `Match highlights pipeline initiated using ${cleanHighlightUrls.length} link(s) with 5-second action clip extraction and spoken commentary!`
          : `Cricket documentary generation initiated for "${match?.matchTitle || "Match Documentary"}" (${videoFormat === "short" ? "60s Short" : "8+ Min Documentary"})!`,
      });
    } catch (err: any) {
      console.error("Cricket documentary trigger error:", err);
      return res.status(500).json({
        success: false,
        error: err.message || "Failed to trigger cricket documentary generation.",
      });
    }
  });

  // 13b. CRICKET STUDIO: Manually publish a generated and reviewed cricket video to YouTube
  app.post("/api/cricket/publish-video", async (req, res) => {
    try {
      const persisted = loadPersistedToken();
      const authHeader = req.headers.authorization?.replace("Bearer ", "");
      const token = authHeader || req.body?.oauthToken || currentOAuthToken || persisted.token;
      const { runId, privacyStatus } = req.body || {};

      if (!token) {
        return res.status(401).json({
          success: false,
          error: "YouTube channel not connected. Please connect your YouTube account first via OAuth.",
        });
      }

      if (!runId) {
        return res.status(400).json({
          success: false,
          error: "Missing runId for the generated video to publish.",
        });
      }

      const result = await publishVideoRunToYouTube(runId, token, privacyStatus || "public");
      return res.json(result);
    } catch (err: any) {
      console.error("Manual cricket video publish error:", err);
      return res.status(500).json({
        success: false,
        error: err.message || "Failed to publish video to YouTube.",
      });
    }
  });

  // 13b. CRICKET HIGHLIGHTS: Inspect 1 to 3 Highlight Links
  app.post("/api/cricket/inspect-highlights", async (req, res) => {
    try {
      const { urls } = req.body || {};
      const rawUrls: string[] = Array.isArray(urls) ? urls : [urls];
      const validUrls = rawUrls
        .map((u) => (typeof u === "string" ? u.trim() : ""))
        .filter((u) => u && (u.includes("http://") || u.includes("https://")))
        .slice(0, 3);

      if (validUrls.length === 0) {
        return res.status(400).json({
          success: false,
          error: "Please provide between 1 and 3 valid video highlight URLs.",
        });
      }

      const apiKey = getResolvedGeminiApiKey();
      const results = await Promise.all(
        validUrls.map(async (url) => {
          return inspectHighlightLink(url, apiKey);
        })
      );

      return res.json({
        success: true,
        total: results.length,
        highlights: results,
      });
    } catch (err: any) {
      console.error("Inspect highlights error:", err);
      return res.status(500).json({
        success: false,
        error: err.message || "Failed to inspect highlight links.",
      });
    }
  });

  // 14. VOICES: List curated ElevenLabs Urdu & Hindi documentary voices
  app.get("/api/voices", (_req, res) => {
    return res.json({
      success: true,
      voices: DOCUMENTARY_VOICES,
      defaultUrduVoice: "aPfeouerZvEVukwmLSP0", // Haseeb #1 Urdu Pick
      defaultHindiVoice: "Y6nOpHQlW4lnf9GRRc8f", // Adarsh #1 Hindi Pick
    });
  });

  // Vite middleware setup
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`AutoTube AI server running on http://0.0.0.0:${PORT}`);
  });

  // Support Cloud Run production ingress on process.env.PORT (e.g. 8080)
  const cloudRunPort = process.env.PORT ? parseInt(process.env.PORT, 10) : 8080;
  if (cloudRunPort && cloudRunPort !== PORT && !isNaN(cloudRunPort)) {
    try {
      const crServer = app.listen(cloudRunPort, "0.0.0.0", () => {
        console.log(`AutoTube AI server also listening on Cloud Run port http://0.0.0.0:${cloudRunPort}`);
      });
      crServer.on("error", (err: any) => {
        // Safe fallback if port already in use in dev container
        console.log(`Cloud Run secondary port ${cloudRunPort} notice: ${err?.message || err}`);
      });
    } catch (err: any) {
      console.warn(`Could not bind secondary port ${cloudRunPort}:`, err);
    }
  }
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
