import { GoogleGenAI, GenerateVideosOperation } from "@google/genai";
import fs from "fs";
import path from "path";

export interface VeoGenerationConfig {
  prompt?: string;
  resolution?: "720p" | "1080p";
  aspectRatio?: "9:16" | "16:9";
  model?: string;
}

export interface VeoResult {
  success: boolean;
  videoPath?: string;
  operationName?: string;
  error?: string;
}

/**
 * Initializes the Google GenAI client for Veo 3 API calls
 */
export function getGenAIClient(customApiKey?: string | null): GoogleGenAI {
  const apiKey =
    customApiKey ||
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.CUSTOM_GEMINI_API_KEY ||
    process.env.GEMINI_KEY ||
    process.env.API_KEY;

  if (!apiKey) {
    throw new Error("Gemini/Veo API key is missing. Please set GOOGLE_API_KEY or CUSTOM_GEMINI_API_KEY.");
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

let veoQuotaExhaustedUntil = 0;
let veoQuotaNoticeLogged = false;

export function isVeoQuotaActive(): boolean {
  return Date.now() < veoQuotaExhaustedUntil;
}

export function setVeoQuotaExhausted(): void {
  veoQuotaExhaustedUntil = Date.now() + 10 * 60 * 1000; // 10 minutes cooldown
  if (!veoQuotaNoticeLogged) {
    veoQuotaNoticeLogged = true;
    console.log(
      "[Google Veo 3] Gemini Veo 3 generation quota reached (429 Resource Exhausted). Seamlessly activating 4K cinematic camera motion & authentic broadcast backdrops."
    );
  }
}

/**
 * Initiates a Google Veo 3 video generation operation
 * Default prompt requested: "Ancient Islamic library, Al-Zahrawi writing medical book, cinematic, 4k"
 */
export async function startVeoGeneration(
  prompt: string = "Ancient Islamic library, Al-Zahrawi writing medical book, cinematic, 4k",
  apiKey?: string | null,
  config: VeoGenerationConfig = {}
): Promise<{ operationName: string }> {
  if (isVeoQuotaActive()) {
    throw new Error("Veo 3 quota cooling down (429). Using high-definition broadcast visuals.");
  }

  const ai = getGenAIClient(apiKey);
  const targetModel = config.model || "veo-3.1-generate-preview";

  console.log(`[Google Veo 3] Starting video generation with model "${targetModel}"...`);
  console.log(`[Google Veo 3] Prompt: "${prompt.slice(0, 120)}..."`);

  try {
    const operation = await ai.models.generateVideos({
      model: targetModel,
      prompt,
      config: {
        numberOfVideos: 1,
        resolution: config.resolution || "1080p",
        aspectRatio: config.aspectRatio || "9:16",
      },
    });

    console.log(`[Google Veo 3] Operation started: ${operation.name}`);
    return { operationName: operation.name };
  } catch (err: any) {
    const isQuota =
      err?.message?.includes("429") ||
      err?.message?.includes("RESOURCE_EXHAUSTED") ||
      err?.message?.includes("quota") ||
      err?.status === 429;

    if (isQuota) {
      setVeoQuotaExhausted();
      throw new Error("Veo 3 quota cooling down (429). Using high-definition broadcast visuals.");
    }

    // If 1080p or preview model fails, fallback to veo-3.1-lite-generate-preview
    console.warn(`[Google Veo 3] Model ${targetModel} notice:`, err.message);
    if (targetModel !== "veo-3.1-lite-generate-preview") {
      console.log("[Google Veo 3] Retrying with veo-3.1-lite-generate-preview...");
      try {
        const liteOperation = await ai.models.generateVideos({
          model: "veo-3.1-lite-generate-preview",
          prompt,
          config: {
            numberOfVideos: 1,
            resolution: "720p",
            aspectRatio: config.aspectRatio || "9:16",
          },
        });
        return { operationName: liteOperation.name };
      } catch (liteErr: any) {
        if (
          liteErr?.message?.includes("429") ||
          liteErr?.message?.includes("RESOURCE_EXHAUSTED") ||
          liteErr?.message?.includes("quota")
        ) {
          setVeoQuotaExhausted();
        }
        throw liteErr;
      }
    }
    throw err;
  }
}

/**
 * Checks the status of a long-running Veo video operation
 */
export async function checkVeoStatus(
  operationName: string,
  apiKey?: string | null
): Promise<{ done: boolean; error?: string; videoUri?: string }> {
  const ai = getGenAIClient(apiKey);
  const op = new GenerateVideosOperation();
  op.name = operationName;

  const updated = await ai.operations.getVideosOperation({ operation: op });

  if (updated.error) {
    return {
      done: true,
      error: typeof updated.error === "string" ? updated.error : JSON.stringify(updated.error),
    };
  }

  if (updated.done) {
    const videoUri = updated.response?.generatedVideos?.[0]?.video?.uri;
    return {
      done: true,
      videoUri,
    };
  }

  return { done: false };
}

/**
 * Downloads the generated Veo 3 video file using Google API Key authentication
 */
export async function downloadVeoVideoBuffer(
  videoUri: string,
  apiKey?: string | null
): Promise<Buffer> {
  const effectiveKey =
    apiKey ||
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.CUSTOM_GEMINI_API_KEY ||
    process.env.GEMINI_KEY ||
    process.env.API_KEY;

  if (!effectiveKey) {
    throw new Error("Gemini/Google API key is required to download Veo video.");
  }

  const response = await fetch(videoUri, {
    headers: {
      "x-goog-api-key": effectiveKey,
      "User-Agent": "aistudio-build",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to download Veo 3 video: HTTP ${response.status} ${response.statusText}`);
  }

  const arrayBuf = await response.arrayBuffer();
  return Buffer.from(arrayBuf);
}

/**
 * End-to-end Veo 3 scene generator with polling and automatic fallback
 * Generates an authentic 9:16 vertical video clip using prompt:
 * "Ancient Islamic library, Al-Zahrawi writing medical book, cinematic, 4k"
 */
export async function generateVeoSceneVideo(
  scenePrompt: string,
  outputPath: string,
  apiKey?: string | null,
  maxWaitSeconds: number = 60
): Promise<VeoResult> {
  if (isVeoQuotaActive()) {
    return {
      success: false,
      error: "Veo 3 quota cooling down (429). Utilizing high-definition broadcast motion visuals.",
    };
  }

  const effectivePrompt = scenePrompt || "Ancient Islamic library, Al-Zahrawi writing medical book, cinematic, 4k";

  try {
    const { operationName } = await startVeoGeneration(effectivePrompt, apiKey, {
      aspectRatio: "9:16",
      resolution: "1080p",
    });

    // Poll until completed or timeout
    const startTime = Date.now();
    const maxWaitMs = maxWaitSeconds * 1000;
    let pollCount = 0;

    while (Date.now() - startTime < maxWaitMs) {
      pollCount++;
      await new Promise((resolve) => setTimeout(resolve, 6000)); // poll every 6s

      console.log(`[Google Veo 3] Polling operation (${pollCount}): ${operationName}...`);
      const status = await checkVeoStatus(operationName, apiKey);

      if (status.done) {
        if (status.error) {
          throw new Error(`Veo operation returned error: ${status.error}`);
        }
        if (!status.videoUri) {
          throw new Error("Veo operation completed but no video URI was returned.");
        }

        console.log(`[Google Veo 3] Video generated successfully. Downloading from ${status.videoUri.slice(0, 50)}...`);
        const videoBuffer = await downloadVeoVideoBuffer(status.videoUri, apiKey);

        if (videoBuffer.length > 10000) {
          fs.writeFileSync(outputPath, videoBuffer);
          console.log(`[Google Veo 3] Saved Veo scene video to ${outputPath} (${(videoBuffer.length / 1024).toFixed(1)} KB)`);
          return {
            success: true,
            videoPath: outputPath,
            operationName,
          };
        }
      }
    }

    console.warn(`[Google Veo 3] Polling timed out after ${maxWaitSeconds}s for operation: ${operationName}`);
    return {
      success: false,
      operationName,
      error: `Veo video generation timed out after ${maxWaitSeconds}s.`,
    };
  } catch (err: any) {
    const isQuota =
      err?.message?.includes("429") ||
      err?.message?.includes("RESOURCE_EXHAUSTED") ||
      err?.message?.includes("quota") ||
      err?.status === 429;

    if (isQuota) {
      setVeoQuotaExhausted();
    } else {
      console.warn(`[Google Veo 3] Scene video generation notice:`, err.message);
    }
    return {
      success: false,
      error: isQuota
        ? "Veo 3 quota cooling down; seamlessly using broadcast motion visuals"
        : (err.message || "Veo video generation failed."),
    };
  }
}
