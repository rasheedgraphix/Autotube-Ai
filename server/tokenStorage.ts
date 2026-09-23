import fs from "fs";
import path from "path";
import { ensureAutotubeDirectory, AUTOTUBE_TMP_DIR } from "./ffmpegHelper";

export const PRIMARY_TOKEN_FILE = path.join(AUTOTUBE_TMP_DIR, "token.json");
export const PROJECT_TOKEN_DIR = path.join(process.cwd(), "data");
export const PROJECT_TOKEN_FILE = path.join(PROJECT_TOKEN_DIR, "token.json");

export interface PersistedTokenData {
  token: string | null;
  channel?: {
    id: string;
    title: string;
    customUrl?: string;
    thumbnail?: string;
    subscriberCount?: string;
    viewCount?: string;
    videoCount?: string;
  } | null;
  updatedAt?: string;
}

/**
 * Saves OAuth token and channel info to persistent files (/tmp/autotube/token.json & data/token.json)
 */
export function savePersistedToken(data: { token: string; channel?: any }): void {
  try {
    ensureAutotubeDirectory();
    if (!fs.existsSync(PROJECT_TOKEN_DIR)) {
      fs.mkdirSync(PROJECT_TOKEN_DIR, { recursive: true, mode: 0o777 });
    }

    const payload: PersistedTokenData = {
      token: data.token,
      channel: data.channel || null,
      updatedAt: new Date().toISOString(),
    };

    const content = JSON.stringify(payload, null, 2);

    // Save to primary /tmp/autotube/token.json
    try {
      fs.writeFileSync(PRIMARY_TOKEN_FILE, content, "utf8");
      try {
        fs.chmodSync(PRIMARY_TOKEN_FILE, 0o666);
      } catch {}
    } catch (err: any) {
      console.warn(`[TokenStorage] Warning writing to ${PRIMARY_TOKEN_FILE}:`, err.message);
    }

    // Save to project data/token.json
    try {
      fs.writeFileSync(PROJECT_TOKEN_FILE, content, "utf8");
      try {
        fs.chmodSync(PROJECT_TOKEN_FILE, 0o666);
      } catch {}
    } catch (err: any) {
      console.warn(`[TokenStorage] Warning writing to ${PROJECT_TOKEN_FILE}:`, err.message);
    }

    console.log(`[TokenStorage] Persisted OAuth token saved successfully (${payload.channel?.title || "connected channel"}).`);
  } catch (e: any) {
    console.error("[TokenStorage] Failed to persist OAuth token:", e.message);
  }
}

/**
 * Loads persisted token from /tmp/autotube/token.json, data/token.json, or process.env
 */
export function loadPersistedToken(): PersistedTokenData {
  // Check env variables first
  const envToken = process.env.YOUTUBE_OAUTH_TOKEN || process.env.YOUTUBE_ACCESS_TOKEN;
  if (envToken) {
    return { token: envToken, channel: null, updatedAt: "env" };
  }

  // Check /tmp/autotube/token.json
  if (fs.existsSync(PRIMARY_TOKEN_FILE)) {
    try {
      const raw = fs.readFileSync(PRIMARY_TOKEN_FILE, "utf8");
      const parsed = JSON.parse(raw);
      if (parsed && parsed.token) {
        return parsed;
      }
    } catch (err: any) {
      console.warn(`[TokenStorage] Could not parse ${PRIMARY_TOKEN_FILE}:`, err.message);
    }
  }

  // Check project data/token.json
  if (fs.existsSync(PROJECT_TOKEN_FILE)) {
    try {
      const raw = fs.readFileSync(PROJECT_TOKEN_FILE, "utf8");
      const parsed = JSON.parse(raw);
      if (parsed && parsed.token) {
        return parsed;
      }
    } catch (err: any) {
      console.warn(`[TokenStorage] Could not parse ${PROJECT_TOKEN_FILE}:`, err.message);
    }
  }

  return { token: null, channel: null };
}

/**
 * Clears persisted token from storage
 */
export function clearPersistedToken(): void {
  try {
    if (fs.existsSync(PRIMARY_TOKEN_FILE)) {
      fs.unlinkSync(PRIMARY_TOKEN_FILE);
    }
    if (fs.existsSync(PROJECT_TOKEN_FILE)) {
      fs.unlinkSync(PROJECT_TOKEN_FILE);
    }
    console.log("[TokenStorage] Persisted OAuth token cleared.");
  } catch (err: any) {
    console.warn("[TokenStorage] Warning clearing token:", err.message);
  }
}
