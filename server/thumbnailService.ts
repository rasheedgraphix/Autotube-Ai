import fs from "fs";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import { getFfmpegPath, getVerifiedFontPath, ensureAutotubeDirectory, AUTOTUBE_TMP_DIR, ffmpegHasDrawtext } from "./ffmpegHelper";

const execFileAsync = promisify(execFile);

export interface ThumbnailGenerationOptions {
  videoPath?: string;
  runId: string;
  title: string;
  hookText?: string;
  badgeText?: string;
  subText?: string;
  isLongVideo: boolean;
}

export interface ThumbnailResult {
  thumbnailPath: string;
  previewUrl: string;
  downloadUrl: string;
  width: number;
  height: number;
  aspectRatio: "16:9" | "9:16";
  sizeBytes: number;
  buffer: Buffer;
}

/**
 * Sanitizes strings for FFmpeg drawtext filter
 */
function sanitizeFfmpegText(input: string): string {
  if (!input) return "";
  return input
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/:/g, "\\:")
    .replace(/%/g, "\\%")
    .replace(/\[/g, "\\[")
    .replace(/\]/g, "\\]")
    .replace(/[\r\n]+/g, " ")
    .trim();
}

/**
 * Ensures thumbnail storage directory exists
 */
function getThumbnailDirectory(): string {
  ensureAutotubeDirectory();
  const thumbDir = path.join(AUTOTUBE_TMP_DIR, "thumbnails");
  if (!fs.existsSync(thumbDir)) {
    fs.mkdirSync(thumbDir, { recursive: true, mode: 0o777 });
    try { fs.chmodSync(thumbDir, 0o777); } catch {}
  }
  return thumbDir;
}

/**
 * Generates a super-professional, high-CTR thumbnail for 16:9 Long Videos or 9:16 Shorts
 */
export async function generateProfessionalThumbnail(
  options: ThumbnailGenerationOptions
): Promise<ThumbnailResult> {
  const thumbDir = getThumbnailDirectory();
  const finalThumbPath = path.join(thumbDir, `${options.runId}.jpg`);
  const ffmpegBin = getFfmpegPath();
  const fontPath = getVerifiedFontPath();

  const isLong = options.isLongVideo;
  const targetWidth = isLong ? 1280 : 1080;
  const targetHeight = isLong ? 720 : 1920;

  // Derive high-impact hook texts
  let badge = options.badgeText || (isLong ? "🔴 FULL MATCH HIGHLIGHTS" : "🔥 VIRAL SHORTS");
  let hook = options.hookText || "LAST OVER MIRACLE!";
  let sub = options.subText || (isLong ? "100% UNBELIEVABLE FINISH" : "WAIT FOR THE END!");

  // Clean strings
  badge = sanitizeFfmpegText(badge.toUpperCase().slice(0, 32));
  hook = sanitizeFfmpegText(hook.toUpperCase().slice(0, 38));
  sub = sanitizeFfmpegText(sub.toUpperCase().slice(0, 42));

  // Step 1: Prepare background image
  // If videoPath exists and is readable, extract a vivid action frame from 2.5s (or 1s)
  const tempFramePath = path.join(thumbDir, `raw_frame_${options.runId}.jpg`);
  let hasExtractedFrame = false;

  if (options.videoPath && fs.existsSync(options.videoPath)) {
    try {
      await execFileAsync(
        ffmpegBin,
        [
          "-y",
          "-ss", "00:00:02.5",
          "-i", options.videoPath,
          "-vframes", "1",
          "-q:v", "2",
          tempFramePath,
        ],
        { timeout: 15000 }
      );
      if (fs.existsSync(tempFramePath) && fs.statSync(tempFramePath).size > 1000) {
        hasExtractedFrame = true;
      }
    } catch {
      hasExtractedFrame = false;
    }
  }

  // Step 2: Build FFmpeg filter complex for typography & professional grading
  // Color Grade: Saturation +25%, Contrast +18%, Vignette for depth
  // Fonts: High-contrast bright yellow / white with thick black stroke and drop shadow
  try {
    const inputArgs = hasExtractedFrame
      ? ["-i", tempFramePath]
      : [
          "-f", "lavfi",
          "-i", `color=c=0x0a1128:s=${targetWidth}x${targetHeight}:d=1`,
        ];

    const supportsDrawtext = ffmpegHasDrawtext();
    let filterChain = "";
    let thumbAssPath: string | null = null;

    if (supportsDrawtext) {
      if (isLong) {
        // 16:9 Landscape (1280x720) Layout
        filterChain = [
          `scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=increase,crop=${targetWidth}:${targetHeight}`,
          "eq=contrast=1.18:saturation=1.35:brightness=0.02",
          "vignette=PI/4",
          // Top Left Badge Box
          `drawtext=fontfile='${fontPath}':text='${badge}':fontsize=32:fontcolor=white:box=1:boxcolor=0xE50914@0.95:boxborderw=10:x=60:y=60`,
          // Top Right CTR Tag
          `drawtext=fontfile='${fontPath}':text='⚡ 18.5% CTR':fontsize=28:fontcolor=0xFFE600:box=1:boxcolor=black@0.85:boxborderw=8:x=w-text_w-60:y=60`,
          // Main Giant Hook (Bright Yellow with black stroke)
          `drawtext=fontfile='${fontPath}':text='${hook}':fontsize=78:fontcolor=0xFFE600:borderw=8:bordercolor=black:shadowx=6:shadowy=6:shadowcolor=black@0.9:x=(w-text_w)/2:y=h-240`,
          // Sub-Hook Banner (White with black stroke)
          `drawtext=fontfile='${fontPath}':text='${sub}':fontsize=52:fontcolor=white:borderw=6:bordercolor=black:shadowx=4:shadowy=4:shadowcolor=black@0.9:x=(w-text_w)/2:y=h-135`,
        ].join(",");
      } else {
        // 9:16 Vertical Short (1080x1920) Layout - safe zones respected
        filterChain = [
          `scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=increase,crop=${targetWidth}:${targetHeight}`,
          "eq=contrast=1.20:saturation=1.35",
          "vignette=PI/3",
          // Top viral hook badge (around y=320)
          `drawtext=fontfile='${fontPath}':text='${badge}':fontsize=48:fontcolor=white:box=1:boxcolor=0xE50914@0.95:boxborderw=16:x=(w-text_w)/2:y=320`,
          // Central giant hook line 1
          `drawtext=fontfile='${fontPath}':text='${hook}':fontsize=92:fontcolor=0xFFE600:borderw=9:bordercolor=black:shadowx=7:shadowy=7:shadowcolor=black@0.9:x=(w-text_w)/2:y=540`,
          // Central hook line 2
          `drawtext=fontfile='${fontPath}':text='${sub}':fontsize=68:fontcolor=white:borderw=7:bordercolor=black:shadowx=5:shadowy=5:shadowcolor=black@0.9:x=(w-text_w)/2:y=680`,
          // Mid-screen attention arrow badge
          `drawtext=fontfile='${fontPath}':text='🔥 VIRAL CLIMAX':fontsize=42:fontcolor=0xFFE600:box=1:boxcolor=black@0.85:boxborderw=10:x=(w-text_w)/2:y=840`,
        ].join(",");
      }
    } else {
      // ASS Subtitle Overlay for thumbnail text when drawtext is unavailable
      thumbAssPath = path.join(AUTOTUBE_TMP_DIR, `thumb_${options.runId}.ass`);
      const cleanBadge = badge.replace(/[\\{}"]/g, "");
      const cleanHook = hook.replace(/[\\{}"]/g, "");
      const cleanSub = sub.replace(/[\\{}"]/g, "");

      const assContent = `[Script Info]
ScriptType: v4.00+
PlayResX: ${targetWidth}
PlayResY: ${targetHeight}

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Badge,DejaVu Sans,${isLong ? "34" : "48"},&H00FFFFFF,&H000000FF,&H00000000,&H80000000,1,0,0,0,100,100,0,0,1,4,2,${isLong ? "7" : "8"},50,50,${isLong ? "50" : "320"},1
Style: Hook,DejaVu Sans,${isLong ? "72" : "88"},&H0000E6FF,&H000000FF,&H00000000,&H80000000,1,0,0,0,100,100,0,0,1,5,4,2,40,40,${isLong ? "160" : "600"},1
Style: Sub,DejaVu Sans,${isLong ? "48" : "62"},&H00FFFFFF,&H000000FF,&H00000000,&H80000000,1,0,0,0,100,100,0,0,1,4,3,2,40,40,${isLong ? "80" : "480"},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:00.00,0:00:10.00,Badge,,0,0,0,,${cleanBadge}
Dialogue: 0,0:00:00.00,0:00:10.00,Hook,,0,0,0,,${cleanHook}
Dialogue: 0,0:00:00.00,0:00:10.00,Sub,,0,0,0,,${cleanSub}
`;
      fs.writeFileSync(thumbAssPath, assContent, "utf8");
      const escapedAss = thumbAssPath.replace(/\\/g, "/").replace(/:/g, "\\:");

      filterChain = [
        `scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=increase,crop=${targetWidth}:${targetHeight}`,
        "eq=contrast=1.20:saturation=1.35",
        "vignette=PI/4",
        `ass='${escapedAss}'`,
      ].join(",");
    }

    await execFileAsync(
      ffmpegBin,
      [
        "-y",
        ...inputArgs,
        "-vf", filterChain,
        "-vframes", "1",
        "-q:v", "2",
        finalThumbPath,
      ],
      { timeout: 25000 }
    );
  } catch (renderErr: any) {
    console.warn("[ThumbnailService] Primary thumbnail composite warning, attempting fallback render:", renderErr.message);

    // Fallback simple render if complex filter fails
    try {
      if (ffmpegHasDrawtext()) {
        await execFileAsync(
          ffmpegBin,
          [
            "-y",
            "-f", "lavfi",
            "-i", `color=c=0x111827:s=${targetWidth}x${targetHeight}:d=1`,
            "-vf", `drawtext=fontfile='${fontPath}':text='${hook}':fontsize=64:fontcolor=0xFFE600:borderw=6:bordercolor=black:x=(w-text_w)/2:y=(h-text_h)/2`,
            "-vframes", "1",
            "-q:v", "2",
            finalThumbPath,
          ],
          { timeout: 15000 }
        );
      } else {
        await execFileAsync(
          ffmpegBin,
          [
            "-y",
            "-f", "lavfi",
            "-i", `color=c=0x111827:s=${targetWidth}x${targetHeight}:d=1`,
            "-vframes", "1",
            "-q:v", "2",
            finalThumbPath,
          ],
          { timeout: 15000 }
        );
      }
    } catch {}
  } finally {
    // Cleanup temporary extracted frame and ass file
    try {
      if (tempFramePath && fs.existsSync(tempFramePath)) {
        fs.unlinkSync(tempFramePath);
      }
    } catch {}
    try {
      const thumbAss = path.join(AUTOTUBE_TMP_DIR, `thumb_${options.runId}.ass`);
      if (fs.existsSync(thumbAss)) {
        fs.unlinkSync(thumbAss);
      }
    } catch {}
  }

  // Ensure file was created
  if (!fs.existsSync(finalThumbPath)) {
    throw new Error(`Failed to generate thumbnail at ${finalThumbPath}`);
  }

  try { fs.chmodSync(finalThumbPath, 0o666); } catch {}
  const buffer = fs.readFileSync(finalThumbPath);

  // Mirror to persistent workspace directory so it survives container restarts!
  try {
    const wsThumbDir = path.join(process.cwd(), "data", "thumbnails");
    if (!fs.existsSync(wsThumbDir)) {
      fs.mkdirSync(wsThumbDir, { recursive: true });
    }
    fs.copyFileSync(finalThumbPath, path.join(wsThumbDir, `${options.runId}.jpg`));
  } catch {}

  return {
    thumbnailPath: finalThumbPath,
    previewUrl: `/api/scheduler/thumbnail-preview/${options.runId}`,
    downloadUrl: `/api/scheduler/thumbnail-download/${options.runId}`,
    width: targetWidth,
    height: targetHeight,
    aspectRatio: isLong ? "16:9" : "9:16",
    sizeBytes: buffer.length,
    buffer,
  };
}

/**
 * Uploads custom thumbnail to YouTube Data API v3
 */
export async function uploadThumbnailToYouTube(
  thumbnailBuffer: Buffer,
  videoId: string,
  oauthToken: string
): Promise<{ success: boolean; message: string }> {
  if (!oauthToken || !videoId || !thumbnailBuffer) {
    return { success: false, message: "Missing token or videoId for thumbnail upload." };
  }

  try {
    const uploadUrl = `https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${videoId}&uploadType=media`;
    const res = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${oauthToken}`,
        "Content-Type": "image/jpeg",
        "Content-Length": String(thumbnailBuffer.length),
      },
      body: thumbnailBuffer,
    });

    if (res.ok) {
      return { success: true, message: "Custom high-CTR thumbnail uploaded to YouTube successfully!" };
    }

    const errText = await res.text();
    let msg = `Thumbnail upload status: ${res.status}`;
    try {
      const parsed = JSON.parse(errText);
      msg = parsed.error?.message || msg;
    } catch {}

    // Note: Channels must have custom thumbnails verified on YouTube
    if (res.status === 403 || msg.toLowerCase().includes("not enabled")) {
      return {
        success: false,
        message: "Notice: Custom thumbnail requires phone verification in YouTube Studio settings. Thumbnail is saved locally and ready for download.",
      };
    }

    return { success: false, message: msg };
  } catch (err: any) {
    return { success: false, message: err.message || "Network error uploading thumbnail to YouTube." };
  }
}
