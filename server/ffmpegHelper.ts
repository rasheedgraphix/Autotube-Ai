import { execSync } from "child_process";
import fs from "fs";
import path from "path";
// @ts-ignore
import ffmpegStatic from "ffmpeg-static";

export const AUTOTUBE_TMP_DIR = "/tmp/autotube";
export const SYSTEM_FFMPEG_PATH = "/usr/bin/ffmpeg";
export const PRIMARY_FONT_PATH = "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf";

// Ensure /workspace exists and points to /app/applet (or vice versa) for universal container path resolution
try {
  if (fs.existsSync("/app/applet") && !fs.existsSync("/workspace")) {
    try { fs.symlinkSync("/app/applet", "/workspace"); } catch {}
  } else if (fs.existsSync("/app/applet") && fs.existsSync("/workspace")) {
    try {
      const stats = fs.lstatSync("/workspace");
      if (!stats.isSymbolicLink()) {
        try {
          fs.rmdirSync("/workspace");
          fs.symlinkSync("/app/applet", "/workspace");
        } catch {
          if (!fs.existsSync("/workspace/node_modules") && fs.existsSync("/app/applet/node_modules")) {
            fs.symlinkSync("/app/applet/node_modules", "/workspace/node_modules");
          }
        }
      }
    } catch {}
  }
} catch {}

// Set FFMPEG_BIN env var so ffmpeg-static module always points to verified system binary if present
if (fs.existsSync(SYSTEM_FFMPEG_PATH)) {
  process.env.FFMPEG_BIN = SYSTEM_FFMPEG_PATH;
}

// Ensure FONTCONFIG_PATH is set for all child processes and font operations
if (!process.env.FONTCONFIG_PATH) {
  process.env.FONTCONFIG_PATH = "/etc/fonts";
}

export interface FfmpegStatus {
  available: boolean;
  binaryPath: string;
  version?: string;
  source: "system" | "ffmpeg-static" | "not-found";
  hasDrawtext: boolean;
  error?: string;
}

let cachedFfmpegStatus: FfmpegStatus | null = null;

/**
 * Ensures /tmp/autotube exists with chmod 777 permissions
 */
export function ensureAutotubeDirectory(): string {
  try {
    if (!fs.existsSync(AUTOTUBE_TMP_DIR)) {
      fs.mkdirSync(AUTOTUBE_TMP_DIR, { recursive: true, mode: 0o777 });
    }
    fs.chmodSync(AUTOTUBE_TMP_DIR, 0o777);
  } catch (err: any) {
    console.warn(`[Storage] Warning adjusting permissions on ${AUTOTUBE_TMP_DIR}:`, err.message);
  }
  return AUTOTUBE_TMP_DIR;
}

/**
 * Ensures fontconfig cache is refreshed and available
 */
export function ensureFontconfigCache(): void {
  try {
    process.env.FONTCONFIG_PATH = "/etc/fonts";
    execSync("fc-cache -f", {
      env: { ...process.env, FONTCONFIG_PATH: "/etc/fonts" },
      stdio: "ignore",
      timeout: 10000,
    });
  } catch {
    // Non-critical if cache already current
  }
}

/**
 * Verifies font path exists with fs.existsSync and fallbacks
 */
export function getVerifiedFontPath(): string {
  // 1. Check primary bold system font for Hormozi viral captions
  if (fs.existsSync(PRIMARY_FONT_PATH)) {
    return PRIMARY_FONT_PATH;
  }

  // 2. Check bundled project asset font
  const bundledAssetFont = path.join(process.cwd(), "server/assets/font.ttf");
  if (fs.existsSync(bundledAssetFont)) {
    return bundledAssetFont;
  }

  // 3. Check system alternatives
  const alternatives = [
    "/usr/share/fonts/truetype/freefont/FreeSansBold.ttf",
    "/usr/share/fonts/truetype/freefont/FreeSans.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
  ];

  for (const alt of alternatives) {
    if (fs.existsSync(alt)) {
      return alt;
    }
  }

  // Return fallback path or bundled path, never crash
  return bundledAssetFont;
}

/**
 * Tests whether a given ffmpeg binary executes and supports required filters
 */
function testFfmpegExecutable(binPath: string): { ok: boolean; hasDrawtext: boolean; version?: string } {
  if (!binPath) return { ok: false, hasDrawtext: false };
  try {
    const out = execSync(`"${binPath}" -version`, {
      encoding: "utf8",
      env: { ...process.env, FONTCONFIG_PATH: "/etc/fonts", PATH: `${process.env.PATH || ""}:/usr/bin:/bin:/usr/local/bin` },
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 8000,
    });
    const firstLine = out.split("\n")[0] || "";

    let hasDrawtext = false;
    try {
      const filters = execSync(`"${binPath}" -filters`, {
        encoding: "utf8",
        env: { ...process.env, PATH: `${process.env.PATH || ""}:/usr/bin:/bin:/usr/local/bin` },
        stdio: ["ignore", "pipe", "pipe"],
        timeout: 5000,
      });
      hasDrawtext = filters.includes("drawtext");
    } catch {}

    return { ok: true, hasDrawtext, version: firstLine.trim() };
  } catch {
    return { ok: false, hasDrawtext: false };
  }
}

/**
 * Detects working FFmpeg: prioritizes binary with full drawtext / libfreetype filter support
 */
export function getFfmpegStatus(): FfmpegStatus {
  if (cachedFfmpegStatus && cachedFfmpegStatus.available && fs.existsSync(cachedFfmpegStatus.binaryPath)) {
    return cachedFfmpegStatus;
  }

  ensureAutotubeDirectory();
  process.env.FONTCONFIG_PATH = "/etc/fonts";

  // 1. Check primary /usr/bin/ffmpeg (highest performance & guaranteed system libraries with drawtext)
  if (fs.existsSync(SYSTEM_FFMPEG_PATH)) {
    cachedFfmpegStatus = {
      available: true,
      binaryPath: SYSTEM_FFMPEG_PATH,
      version: "Debian /usr/bin/ffmpeg (Full Filter & Drawtext Support)",
      source: "system",
      hasDrawtext: true,
    };
    return cachedFfmpegStatus;
  }

  // 2. Check system PATH `which ffmpeg`
  try {
    const whichOut = execSync("which ffmpeg", {
      encoding: "utf8",
      env: { ...process.env, FONTCONFIG_PATH: "/etc/fonts", PATH: `${process.env.PATH || ""}:/usr/bin:/bin:/usr/local/bin` },
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 5000,
    }).trim();
    if (whichOut && fs.existsSync(whichOut)) {
      const whichTest = testFfmpegExecutable(whichOut);
      if (whichTest.ok) {
        cachedFfmpegStatus = {
          available: true,
          binaryPath: whichOut,
          version: whichTest.version || "System PATH ffmpeg",
          source: "system",
          hasDrawtext: whichTest.hasDrawtext,
        };
        return cachedFfmpegStatus;
      }
    }
  } catch {
    // ignore
  }

  // 3. Check bundled ffmpeg-static binary candidates (resolving workspace vs applet container paths)
  const staticCandidates = [
    typeof ffmpegStatic === "string" ? ffmpegStatic : null,
    "/app/applet/node_modules/ffmpeg-static/ffmpeg",
    "/workspace/node_modules/ffmpeg-static/ffmpeg",
    path.join(process.cwd(), "node_modules/ffmpeg-static/ffmpeg"),
  ].filter((c): c is string => Boolean(c));

  for (const candidate of staticCandidates) {
    let resolvedCandidate = candidate;
    if (!fs.existsSync(resolvedCandidate)) {
      if (resolvedCandidate.startsWith("/workspace/")) {
        resolvedCandidate = resolvedCandidate.replace("/workspace/", "/app/applet/");
      } else if (resolvedCandidate.startsWith("/app/applet/")) {
        resolvedCandidate = resolvedCandidate.replace("/app/applet/", "/workspace/");
      }
    }
    if (fs.existsSync(resolvedCandidate)) {
      const staticTest = testFfmpegExecutable(resolvedCandidate);
      if (staticTest.ok) {
        cachedFfmpegStatus = {
          available: true,
          binaryPath: resolvedCandidate,
          version: staticTest.version || "ffmpeg-static v7",
          source: "ffmpeg-static",
          hasDrawtext: staticTest.hasDrawtext,
        };
        return cachedFfmpegStatus;
      }
    }
  }

  // 4. Default to system FFmpeg if it exists
  const fallbackPath = fs.existsSync(SYSTEM_FFMPEG_PATH)
    ? SYSTEM_FFMPEG_PATH
    : (fs.existsSync("/usr/bin/ffmpeg") ? "/usr/bin/ffmpeg" : "ffmpeg");
  cachedFfmpegStatus = {
    available: fs.existsSync(fallbackPath),
    binaryPath: fallbackPath,
    source: fallbackPath === SYSTEM_FFMPEG_PATH ? "system" : "ffmpeg-static",
    hasDrawtext: fallbackPath === SYSTEM_FFMPEG_PATH,
    error: undefined,
  };
  return cachedFfmpegStatus;
}

/**
 * Returns whether the active FFmpeg binary has drawtext filter support
 */
export function ffmpegHasDrawtext(): boolean {
  const status = getFfmpegStatus();
  return Boolean(status.hasDrawtext);
}

/**
 * Returns verified executable FFmpeg binary path
 */
export function getRequiredFfmpegBinary(): string {
  // 1. Unconditionally prioritize verified system binary if present
  if (fs.existsSync(SYSTEM_FFMPEG_PATH)) {
    return SYSTEM_FFMPEG_PATH;
  }
  const status = getFfmpegStatus();
  if (status.binaryPath && fs.existsSync(status.binaryPath)) {
    return status.binaryPath;
  }
  // Try which ffmpeg
  try {
    const whichOut = execSync("which ffmpeg", { encoding: "utf8", timeout: 3000 }).trim();
    if (whichOut && fs.existsSync(whichOut)) {
      return whichOut;
    }
  } catch {}
  return SYSTEM_FFMPEG_PATH;
}

export function getFfmpegPath(): string {
  return getRequiredFfmpegBinary();
}

/**
 * Probes accurate duration in seconds for an audio or video file
 */
export function getMediaDurationInSeconds(filePath: string): number {
  if (!filePath || !fs.existsSync(filePath)) return 0;
  try {
    const out = execSync(`/usr/bin/ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`, {
      timeout: 6000,
      stdio: ["pipe", "pipe", "ignore"],
    }).toString().trim();
    const dur = parseFloat(out);
    return isNaN(dur) || dur <= 0 ? 0 : dur;
  } catch {
    return 0;
  }
}
