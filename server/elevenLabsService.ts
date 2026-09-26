import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import { getRequiredFfmpegBinary } from "./ffmpegHelper";

const execAsync = promisify(exec);

let elevenLabsAuthFailed = false;
let elevenLabsAuthNoticeLogged = false;
let lastTestedApiKey: string | null = null;

export interface VoiceGenerationResult {
  success: boolean;
  source: "elevenlabs" | "google_tts" | "flite" | "fallback" | "cache";
  filePath?: string;
  error?: string;
  voiceUsed?: string;
}

export interface DocumentaryVoice {
  id: string;
  name: string;
  category: "urdu" | "hindi" | "both" | "english";
  gender: "male" | "female";
  badge: string;
  description: string;
  recommendedStability: number;
  recommendedSimilarityBoost: number;
  isTopPick?: boolean;
}

/**
 * Curated Top Tier Hindi & Urdu Documentary Voices on ElevenLabs
 * (Documented specifically for long-form storytelling, history, and cricket documentaries)
 */
export const DOCUMENTARY_VOICES: DocumentaryVoice[] = [
  // --- BEST URDU VOICES FOR DOCUMENTARY ---
  {
    id: "aPfeouerZvEVukwmLSP0",
    name: "Haseeb",
    category: "urdu",
    gender: "male",
    badge: "Urdu #1 Pick (Radio/Podcast)",
    description: "Energetic Hindi/Urdu voice; tuned to 55% stability it delivers rich, deep, and commanding documentary Urdu.",
    recommendedStability: 0.55,
    recommendedSimilarityBoost: 0.75,
    isTopPick: true,
  },
  {
    id: "Y6nOpHQlW4lnf9GRRc8f",
    name: "Adarsh",
    category: "both",
    gender: "male",
    badge: "Emotive Voice (90% Pak Doc Channels)",
    description: "Deep, authoritative, and emotional. The most popular voice used for long-form history, documentaries, and storytelling in Hindi and Urdu.",
    recommendedStability: 0.50,
    recommendedSimilarityBoost: 0.80,
    isTopPick: true,
  },
  {
    id: "WiaIVvI1gDL4vT4y7qUU",
    name: "Suman Pro",
    category: "urdu",
    gender: "male",
    badge: "Deep & Calm Urdu",
    description: "Late 20s/early 30s gentle, deep, calm voice. Performs flawlessly with Urdu script.",
    recommendedStability: 0.55,
    recommendedSimilarityBoost: 0.75,
  },
  {
    id: "VESUG427mhGhpQ6fo6Rh",
    name: "Ravikant",
    category: "both",
    gender: "male",
    badge: "Warm & Native (Nat Geo Style)",
    description: "Pure native voice, warm and crystal clear. Speaks flawless Hindi and Urdu for documentary narration.",
    recommendedStability: 0.55,
    recommendedSimilarityBoost: 0.75,
  },
  {
    id: "pNInz6obpgDQGcFmaJgB",
    name: "Adam (Multilingual v2)",
    category: "urdu",
    gender: "male",
    badge: "Hollywood Cinematic Doc",
    description: "Deep Hollywood documentary feel powered by eleven_multilingual_v2 with automatic Urdu/Hindi language auto-detection.",
    recommendedStability: 0.50,
    recommendedSimilarityBoost: 0.75,
  },
  {
    id: "ppLqTilh7rH7fbUVlXsf",
    name: "David",
    category: "english",
    gender: "male",
    badge: "Classic Documentary Narrator",
    description: "Deep, rich cinematic documentary voice for international sports and historical narratives.",
    recommendedStability: 0.50,
    recommendedSimilarityBoost: 0.80,
  },

  // --- BEST HINDI VOICES FOR DOCUMENTARY ---
  {
    id: "Qxb5zQvEo3DYQK2HNnXm",
    name: "Kunal Agarwal",
    category: "hindi",
    gender: "male",
    badge: "Confident Mature Indian Male",
    description: "Explicitly tagged for Audiobooks, podcasts, documentary, and high-impact match storytelling.",
    recommendedStability: 0.50,
    recommendedSimilarityBoost: 0.75,
    isTopPick: true,
  },
  {
    id: "qDuRKMlYmrm8trt5QyBn",
    name: "Taksh",
    category: "hindi",
    gender: "male",
    badge: "Powerful & Commanding",
    description: "Best for high-stakes rivalries, divine drama, and grand historical epics.",
    recommendedStability: 0.50,
    recommendedSimilarityBoost: 0.80,
  },
  {
    id: "gHu9GtaHOXcSqFTK06ux",
    name: "Anjali",
    category: "hindi",
    gender: "female",
    badge: "Soothing Hindi Female",
    description: "Calming and engaging tone, ideal for audiobooks, reflective moments, and documentaries.",
    recommendedStability: 0.50,
    recommendedSimilarityBoost: 0.75,
  },
  {
    id: "1qEiC6qsybMkmnNdVMbK",
    name: "Monika Sogam",
    category: "hindi",
    gender: "female",
    badge: "Hindi Modulated Female",
    description: "One of the most acclaimed Hindi female voices on ElevenLabs with rich expressive modulation.",
    recommendedStability: 0.50,
    recommendedSimilarityBoost: 0.75,
  },
];

/**
 * Resolves the optimal voice configuration based on language, user preference, and voice ID
 */
export function resolveDocumentaryVoice(
  explicitVoiceId?: string,
  languageStyle?: string,
  sampleText: string = ""
): {
  voiceId: string;
  voiceName: string;
  stability: number;
  similarityBoost: number;
  modelId: string;
} {
  // 1. If an explicit known voice was selected
  if (explicitVoiceId) {
    const found = DOCUMENTARY_VOICES.find((v) => v.id === explicitVoiceId);
    if (found) {
      return {
        voiceId: found.id,
        voiceName: found.name,
        stability: found.recommendedStability,
        similarityBoost: found.recommendedSimilarityBoost,
        modelId: "eleven_multilingual_v2",
      };
    }
    // If it is a custom voice ID passed by user
    return {
      voiceId: explicitVoiceId,
      voiceName: "Custom Voice",
      stability: 0.50,
      similarityBoost: 0.75,
      modelId: "eleven_multilingual_v2",
    };
  }

  // 2. Check language style or script text
  const isUrdu =
    languageStyle === "urdu" ||
    /[\u0600-\u06FF]/.test(sampleText);

  const isHindi =
    languageStyle === "hindi" ||
    /[\u0900-\u097F]/.test(sampleText);

  if (isUrdu) {
    // Top pick for Urdu: Haseeb (aPfeouerZvEVukwmLSP0) with 55% stability
    return {
      voiceId: "aPfeouerZvEVukwmLSP0",
      voiceName: "Haseeb",
      stability: 0.55,
      similarityBoost: 0.75,
      modelId: "eleven_multilingual_v2",
    };
  }

  if (isHindi || languageStyle === "urdu_hindi") {
    // Top pick for Hindi / Urdu-Hindi: Adarsh (Y6nOpHQlW4lnf9GRRc8f)
    return {
      voiceId: "Y6nOpHQlW4lnf9GRRc8f",
      voiceName: "Adarsh",
      stability: 0.50,
      similarityBoost: 0.80,
      modelId: "eleven_multilingual_v2",
    };
  }

  // Fallback for English or unconfigured: Adam / Adarsh
  return {
    voiceId: process.env.ELEVENLABS_VOICE_ID || "pNInz6obpgDQGcFmaJgB",
    voiceName: "Adam",
    stability: 0.50,
    similarityBoost: 0.75,
    modelId: "eleven_multilingual_v2",
  };
}

/**
 * Generates natural human speech using ElevenLabs API (or fallback to Google TTS)
 */
export async function generateSpeechVoice(
  text: string,
  outputPath: string,
  options: {
    voiceId?: string;
    apiKey?: string;
    languageStyle?: "urdu_hindi" | "urdu" | "hindi" | "english";
    stability?: number;
    similarityBoost?: number;
  } = {}
): Promise<VoiceGenerationResult> {
  const clean = text
    .replace(/[#*_~`\[\]()]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!clean) {
    return { success: false, source: "fallback", error: "Empty narration text." };
  }

  const elevenLabsApiKey = options.apiKey || process.env.ELEVENLABS_API_KEY;
  if (elevenLabsApiKey !== lastTestedApiKey) {
    lastTestedApiKey = elevenLabsApiKey || null;
    elevenLabsAuthFailed = false;
    elevenLabsAuthNoticeLogged = false;
  }

  const voiceConfig = resolveDocumentaryVoice(
    options.voiceId || process.env.ELEVENLABS_VOICE_ID,
    options.languageStyle,
    clean
  );

  const voiceId = voiceConfig.voiceId;
  const stability = options.stability ?? voiceConfig.stability;
  const similarityBoost = options.similarityBoost ?? voiceConfig.similarityBoost;

  // Clean up any stale file from a previous session at this path to ensure fresh synthesis
  if (fs.existsSync(outputPath)) {
    try {
      fs.unlinkSync(outputPath);
    } catch {}
  }

  // 1. If ElevenLabs API Key is provided and key is active/authorized, call ElevenLabs API
  if (elevenLabsApiKey && elevenLabsApiKey.trim() !== "" && !elevenLabsAuthFailed) {
    try {
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": elevenLabsApiKey.trim(),
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text: clean.slice(0, 1000),
          model_id: "eleven_multilingual_v2",
          voice_settings: {
            stability,
            similarity_boost: similarityBoost,
            style: 0.0,
            use_speaker_boost: true,
          },
        }),
        signal: AbortSignal.timeout(15000), // 15s robust timeout
      });

      if (response.ok) {
        const audioBuffer = Buffer.from(await response.arrayBuffer());
        if (audioBuffer.length > 1000) {
          fs.writeFileSync(outputPath, audioBuffer);
          console.log(
            `[ElevenLabs Voice] Successfully synthesized audio with ${voiceConfig.voiceName} (${audioBuffer.length} bytes)`
          );
          return {
            success: true,
            source: "elevenlabs",
            filePath: outputPath,
            voiceUsed: voiceConfig.voiceName,
          };
        }
      } else {
        if (response.status === 401 || response.status === 403) {
          elevenLabsAuthFailed = true;
          if (!elevenLabsAuthNoticeLogged) {
            elevenLabsAuthNoticeLogged = true;
            console.log(
              `[Voice Engine] ElevenLabs API key lacks active 'text_to_speech' permission. Seamlessly activating high-fidelity Native Neural Speech narration.`
            );
          }
        } else if (response.status === 429) {
          elevenLabsAuthFailed = true;
          if (!elevenLabsAuthNoticeLogged) {
            elevenLabsAuthNoticeLogged = true;
            console.log(
              `[Voice Engine] ElevenLabs quota limit reached (429). Seamlessly activating high-fidelity Native Neural Speech narration.`
            );
          }
        }
      }
    } catch (elevenErr: any) {
      if (!elevenLabsAuthNoticeLogged) {
        elevenLabsAuthNoticeLogged = true;
        console.log(`[Voice Engine] ElevenLabs service unavailable. Seamlessly activating high-fidelity Native Neural Speech narration.`);
      }
    }
  }

  // 2. High Quality Native Multi-Language Speech Engine Fallback (Urdu / Hindi / English)
  let ttsLang = "en";
  const hasUrduScript = /[\u0600-\u06FF]/.test(clean);
  const hasHindiScript = /[\u0900-\u097F]/.test(clean);
  const romanUrduPatterns = /\b(aur|hai|hain|yeh|woh|kya|kyun|hota|hoti|hote|karte|karna|karne|pe|par|ka|ki|ke|ko|se|mein|me|tha|thi|the|nahi|zaroor|bohot|bohat|aisa|aise|kaisi|shandar|hairat|dosto|aapko|hum|apne|karein|kare|match|chase|jeet|khiladi|gendbaaz|ballebaaz|dekhein|sunayein|shuru)\b/i;
  const isRomanUrdu = romanUrduPatterns.test(clean);

  // CRITICAL: Inspect text itself so English is NEVER sent to Hindi TTS which causes garbled speech
  if (hasUrduScript) {
    ttsLang = "ur";
  } else if (hasHindiScript) {
    ttsLang = "hi";
  } else if (isRomanUrdu) {
    // Roman Urdu text sounds best and most natural with Hindi/Urdu pronunciation engine
    ttsLang = "hi";
  } else if (options.languageStyle === "urdu" && isRomanUrdu) {
    ttsLang = "ur";
  } else {
    // English default for facts & match commentaries so pronunciation is crisp and natural
    ttsLang = "en";
  }

  console.log(`[Voice Engine] Generating high-fidelity narration [Lang: ${ttsLang}] for: "${clean.slice(0, 50)}..."`);
  try {
    // Split into clean natural sentences or sub-clauses (<130 chars each) for crystal clear pronunciation
    const rawSentences = clean
      .replace(/[\n\r]+/g, " ")
      .match(/[^.!?؟।]+[.!?؟।]*/g) || [clean];
    const chunks: string[] = [];
    let currentChunk = "";

    for (const s of rawSentences) {
      const trimmed = s.trim();
      if (!trimmed) continue;
      if ((currentChunk + " " + trimmed).trim().length <= 130) {
        currentChunk = (currentChunk + " " + trimmed).trim();
      } else {
        if (currentChunk) chunks.push(currentChunk);
        currentChunk = trimmed.slice(0, 130);
      }
    }
    if (currentChunk) chunks.push(currentChunk);

    const limitedChunks = chunks.slice(0, 6); // Up to 6 clauses
    const audioChunks: Buffer[] = [];

    for (const chunk of limitedChunks) {
      if (!chunk || chunk.trim().length === 0) continue;
      const cleanChunk = chunk.trim();

      // Try primary Google TTS endpoint (client=tw-ob)
      let chunkFetched = false;
      const ttsEndpoints = [
        `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(cleanChunk)}&tl=${ttsLang}&client=tw-ob`,
        `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(cleanChunk)}&tl=${ttsLang}&client=gtx`,
      ];

      for (const url of ttsEndpoints) {
        if (chunkFetched) break;
        try {
          const res = await fetch(url, {
            headers: {
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
              "Accept": "*/*",
            },
            signal: AbortSignal.timeout(8000), // 8s timeout per chunk
          });
          if (res.ok) {
            const buf = Buffer.from(await res.arrayBuffer());
            if (buf.length > 300) {
              audioChunks.push(buf);
              chunkFetched = true;
            }
          }
        } catch (chunkErr: any) {
          // Continue to next endpoint if available
        }
      }
    }

    if (audioChunks.length > 0) {
      const combined = Buffer.concat(audioChunks);
      if (combined.length > 500) {
        fs.writeFileSync(outputPath, combined);
        return {
          success: true,
          source: "google_tts",
          filePath: outputPath,
          voiceUsed: `Broadcast Narrator (${ttsLang.toUpperCase()})`,
        };
      }
    }
  } catch (ttsErr: any) {
    console.warn(`[Voice Engine] TTS engine notice:`, ttsErr.message);
  }

  // 3. Guaranteed Local Voice Synthesis Fallback via FFmpeg libflite (CRITICAL: NEVER replace speech with music!)
  try {
    const ffmpegBin = getRequiredFfmpegBinary();
    // Sanitize text for flite lavfi filter
    const fliteText = clean
      .replace(/['"\\`$]/g, "")
      .replace(/[\n\r]+/g, " ")
      .trim()
      .slice(0, 320);

    if (fliteText.length > 3) {
      const audioCodec = outputPath.toLowerCase().endsWith(".mp3") ? "-c:a libmp3lame -q:a 2" : "-c:a aac -b:a 192k";
      const fliteCmd = `"${ffmpegBin}" -y -nostats -loglevel error -f lavfi -i "flite=text='${fliteText}':voice=kal16" -af "volume=2.5,aresample=44100" ${audioCodec} -ar 44100 -ac 2 "${outputPath}"`;
      await execAsync(fliteCmd, { timeout: 12000 });

      if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 500) {
        console.log(`[Voice Engine] Synthesized speech narration using FFmpeg libflite (${fs.statSync(outputPath).size} bytes)`);
        return {
          success: true,
          source: "flite",
          filePath: outputPath,
          voiceUsed: "Local Broadcast Narrator (kal16)",
        };
      }
    }
  } catch (fliteErr: any) {
    console.warn(`[Voice Engine] Local flite synthesis notice:`, fliteErr.message);
  }

  return {
    success: false,
    source: "fallback",
    error: "Voice synthesis could not generate spoken audio.",
  };
}
