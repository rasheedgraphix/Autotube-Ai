import React from "react";
import {
  CheckCircle2,
  Clock,
  ExternalLink,
  Film,
  Sparkles,
  Upload,
  Zap,
  Activity,
  Play,
  Share2,
  Layers,
  AlertCircle,
  TrendingUp,
  Image as ImageIcon,
  Download,
  Tag,
} from "lucide-react";

interface PipelineLiveTrackerProps {
  pipelineStatus: any;
  onRefresh?: () => void;
  compact?: boolean;
  connectedToken?: string | null;
}

export default function PipelineLiveTracker({
  pipelineStatus,
  onRefresh,
  compact = false,
  connectedToken,
}: PipelineLiveTrackerProps) {
  const [isResetting, setIsResetting] = React.useState(false);
  const [isPublishing, setIsPublishing] = React.useState(false);
  const [publishMessage, setPublishMessage] = React.useState<string | null>(null);
  const [publishError, setPublishError] = React.useState<string | null>(null);
  const [showVideoModal, setShowVideoModal] = React.useState(false);
  const isRunning = Boolean(pipelineStatus?.isRunning);

  const handleReset = async () => {
    try {
      setIsResetting(true);
      await fetch("/api/pipeline/reset", { method: "POST" });
      if (onRefresh) onRefresh();
    } catch (e) {
      console.error(e);
    } finally {
      setIsResetting(false);
    }
  };

  const handleManualUpload = async (runId: string) => {
    try {
      setIsPublishing(true);
      setPublishError(null);
      setPublishMessage(null);

      const savedToken = connectedToken || localStorage.getItem("autotube_token");
      const res = await fetch("/api/cricket/publish-video", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(savedToken ? { Authorization: `Bearer ${savedToken}` } : {}),
        },
        body: JSON.stringify({
          runId,
          oauthToken: savedToken,
          privacyStatus: "public",
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to publish video to YouTube.");
      }

      setPublishMessage(data.message || "Video published to YouTube successfully!");
      if (onRefresh) onRefresh();
    } catch (err: any) {
      setPublishError(err.message || "Failed to publish video to YouTube.");
    } finally {
      setIsPublishing(false);
    }
  };
  const currentStep = pipelineStatus?.currentStep || "idle";
  const progress = pipelineStatus?.progress || {};
  const activeLogs = pipelineStatus?.activeLogs || [];
  const history = pipelineStatus?.history || [];
  const lastVideo =
    pipelineStatus?.lastVideo ||
    progress.lastVideo ||
    (progress.currentVideoMetadata?.previewUrl ? progress.currentVideoMetadata : null) ||
    (history.length > 0 && history[0]?.video?.previewUrl
      ? {
          id: history[0].id,
          title: history[0].script?.title,
          format: history[0].video?.format,
          durationSeconds: history[0].video?.durationSeconds,
          sizeBytes: history[0].video?.sizeBytes,
          previewUrl: history[0].video?.previewUrl,
          thumbnailUrl: history[0].thumbnail?.previewUrl,
          thumbnailDownloadUrl: history[0].thumbnail?.downloadUrl,
          youtubeUrl: history[0].youtube?.videoUrl,
          videoId: history[0].youtube?.videoId,
          seoAnalysis: history[0].seoAnalysis,
        }
      : null);

  const isVideoReady = Boolean(progress.isVideoReady || lastVideo?.previewUrl);
  const isUploadReady = Boolean(progress.isUploadReady || lastVideo?.youtubeUrl);
  const percent = progress.percent ?? (isRunning ? 25 : lastVideo ? 100 : 0);
  const stageIndex = progress.stageIndex ?? (isRunning ? 2 : lastVideo ? 5 : 0);
  const totalStages = progress.totalStages || 5;
  const stageTitle = progress.stageTitle || (isRunning ? "Video Processing..." : lastVideo ? "Video Ready (Preview & Review)" : "Idle");
  const stageDescription = progress.stageDescription || (isRunning ? "Working on audio/visual elements..." : lastVideo ? "Video has been generated and is ready to watch or publish." : "Ready to produce content.");
  const stageDetail = progress.stageDetail || "";
  const uploadPercent = progress.uploadPercent ?? (isUploadReady ? 100 : 0);
  const totalVideosGenerated = progress.totalVideosGenerated ?? history.filter((h: any) => h.status === "success").length;

  const stages = [
    { num: 1, title: "AI Research", subtitle: "Topic & Scorecard", icon: "🧠" },
    { num: 2, title: "Screenplay", subtitle: "Story Scripting", icon: "📝" },
    { num: 3, title: "Voiceover", subtitle: "Commentary Audio", icon: "🎙️" },
    { num: 4, title: "4K Visuals", subtitle: "Backdrops & Subtitles", icon: "🎬" },
    { num: 5, title: "YouTube Live", subtitle: "Resumable Upload", icon: "🚀" },
  ];

  return (
    <div className="space-y-4">
      {/* 4 Big Key Answers Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Answer 1: Video Ban Gayi Ya Nahi? */}
        <div className={`p-4 rounded-2xl border transition-all ${
          isVideoReady || lastVideo
            ? "bg-emerald-950/40 border-emerald-500/50 shadow-emerald-950/30"
            : isRunning
            ? "bg-amber-950/40 border-amber-500/50 shadow-amber-950/30 animate-pulse"
            : "bg-slate-900/80 border-slate-800"
        }`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Video Status (Ban Gayi?)
            </span>
            {isVideoReady || lastVideo ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[11px] font-bold">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                Tayyar Hai ✅
              </span>
            ) : isRunning ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[11px] font-bold">
                <Activity className="w-3 h-3 animate-spin text-amber-400" />
                Ban Rahi Hai...
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 text-[11px] font-semibold">
                Idle / Ready
              </span>
            )}
          </div>
          <div className="text-lg font-black text-white">
            {isVideoReady || lastVideo ? "🟢 Video Ban Chuki Hai" : isRunning ? "🟡 Process Jaari Hai" : "⚪ Queue Khali Hai"}
          </div>
          <p className="text-xs text-slate-400 mt-1 line-clamp-1">
            {lastVideo ? `${lastVideo.title || "Latest Video"}` : isRunning ? "Engine is rendering scenes..." : "Click generate to produce video."}
          </p>
        </div>

        {/* Answer 2: Kitni Bani? */}
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-md">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Total Production (Kitni Bani?)
            </span>
            <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 text-[11px] font-bold">
              Production Count
            </span>
          </div>
          <div className="text-2xl font-black text-white flex items-baseline gap-2">
            <span>{totalVideosGenerated}</span>
            <span className="text-xs font-semibold text-slate-400">Videos Total</span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {totalVideosGenerated > 0 ? `${totalVideosGenerated} videos stored & ready in library` : "Peheli video generate karein"}
          </p>
        </div>

        {/* Answer 3: Ab Kya Ho Raha Hai? */}
        <div className={`p-4 rounded-2xl border transition-all ${
          isRunning ? "bg-cyan-950/40 border-cyan-500/50 shadow-cyan-950/30" : "bg-slate-900/80 border-slate-800"
        }`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Live Action (Ab Kya Ho Raha Hai?)
            </span>
            <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
              isRunning ? "bg-cyan-500/20 text-cyan-300" : "bg-slate-800 text-slate-400"
            }`}>
              {isRunning ? `Stage ${stageIndex}/${totalStages}` : "Idle"}
            </span>
          </div>
          <div className="text-sm font-black text-white line-clamp-1">
            {stageTitle}
          </div>
          <p className="text-xs text-cyan-300/80 mt-1 line-clamp-1">
            {stageDetail || stageDescription}
          </p>
        </div>

        {/* Answer 4: Upload Kitni Howi? */}
        <div className={`p-4 rounded-2xl border transition-all ${
          isUploadReady || lastVideo?.youtubeUrl
            ? "bg-red-950/30 border-red-500/40"
            : isRunning
            ? "bg-slate-900/80 border-slate-800"
            : "bg-slate-900/80 border-slate-800"
        }`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              YouTube Upload (Kitni Howi?)
            </span>
            <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
              isUploadReady || lastVideo?.youtubeUrl
                ? "bg-emerald-500/20 text-emerald-300"
                : isRunning && uploadPercent > 0
                ? "bg-amber-500/20 text-amber-300"
                : "bg-slate-800 text-slate-400"
            }`}>
              {isUploadReady || lastVideo?.youtubeUrl ? "100% Uploaded" : isRunning ? `${uploadPercent}% Upload` : "Pending"}
            </span>
          </div>
          <div className="text-sm font-black text-white">
            {isUploadReady || lastVideo?.youtubeUrl ? (
              <span className="text-emerald-300 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" /> YouTube Per Live Hai
              </span>
            ) : isRunning && uploadPercent > 0 ? (
              <span className="text-amber-300">Uploading to Channel ({uploadPercent}%)</span>
            ) : isRunning ? (
              <span className="text-slate-300">Rendering (Upload Starts at 90%)</span>
            ) : (
              <span className="text-slate-400">Awaiting Upload</span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {lastVideo?.youtubeUrl ? (
              <a
                href={lastVideo.youtubeUrl}
                target="_blank"
                rel="noreferrer"
                className="text-red-400 hover:text-red-300 underline font-bold inline-flex items-center gap-1"
              >
                <span>Open YouTube Link</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            ) : (
              "Channel connected via OAuth"
            )}
          </p>
        </div>
      </div>

      {/* Real-time Progress Bar & 5-Step Stepper */}
      <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span>Full Pipeline Stepper: 0% to 100% Complete</span>
            </h4>
            <p className="text-xs text-slate-400">
              {stageDescription}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono font-bold text-emerald-400 px-3 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
              {percent}% Finished
            </span>
            {isRunning && (
              <button
                onClick={handleReset}
                disabled={isResetting}
                className="text-xs text-rose-400 hover:text-rose-200 px-2.5 py-1 rounded bg-rose-500/20 border border-rose-500/40 transition-all cursor-pointer font-bold disabled:opacity-50"
                title="Stop current generation and reset"
              >
                {isResetting ? "Stopping..." : "⏹️ Stop / Reset"}
              </button>
            )}
            {onRefresh && (
              <button
                onClick={onRefresh}
                className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded bg-slate-800 transition-all cursor-pointer"
              >
                Refresh Status
              </button>
            )}
          </div>
        </div>

        {/* Visual Progress Bar */}
        <div className="w-full bg-slate-950 rounded-full h-3 p-0.5 overflow-hidden border border-slate-800">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              percent >= 100
                ? "bg-gradient-to-r from-emerald-500 to-teal-400 shadow-[0_0_12px_rgba(16,185,129,0.5)]"
                : "bg-gradient-to-r from-emerald-600 via-amber-500 to-cyan-400 animate-pulse"
            }`}
            style={{ width: `${Math.max(percent, isRunning ? 6 : 0)}%` }}
          />
        </div>

        {/* 5 Distinct Step Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1">
          {stages.map((st) => {
            const isCompleted = stageIndex > st.num || percent >= 100;
            const isCurrent = stageIndex === st.num && isRunning;
            return (
              <div
                key={st.num}
                className={`p-2.5 rounded-xl border text-center transition-all ${
                  isCurrent
                    ? "bg-emerald-500/20 border-emerald-500 text-white ring-2 ring-emerald-500/30 scale-[1.02]"
                    : isCompleted
                    ? "bg-slate-950 border-emerald-500/40 text-slate-300"
                    : "bg-slate-950/60 border-slate-800/80 text-slate-500"
                }`}
              >
                <div className="text-lg mb-0.5">{st.icon}</div>
                <div className="text-xs font-bold truncate">
                  {st.num}. {st.title}
                </div>
                <div className="text-[10px] text-slate-400 truncate">
                  {isCurrent ? "⏳ In Progress" : isCompleted ? "✅ Done" : st.subtitle}
                </div>
              </div>
            );
          })}
        </div>

        {/* Active Logs Console (if running or has logs) */}
        {activeLogs.length > 0 && !compact && (
          <div className="mt-3">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center justify-between">
              <span>Live Terminal Telemetry ({activeLogs.length} events logged)</span>
              {isRunning && <span className="text-emerald-400 text-[10px] animate-pulse">● LIVE STREAMING</span>}
            </div>
            <div className="bg-slate-950 rounded-xl p-3 max-h-32 overflow-y-auto font-mono text-[11px] text-slate-300 space-y-1 border border-slate-800">
              {activeLogs.map((log: any, idx: number) => (
                <div key={idx} className="flex items-start gap-2">
                  <span className="text-emerald-400 shrink-0">[{log.step}]</span>
                  <span className="text-slate-300">{log.message}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Latest Generated Video Banner (Preview & Direct Watch) */}
      {lastVideo && (
        <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-emerald-950/50 border border-emerald-500/30 shadow-xl space-y-4">
          {publishMessage && (
            <div className="p-3 rounded-xl bg-emerald-950/70 border border-emerald-500/60 text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{publishMessage}</span>
            </div>
          )}
          {publishError && (
            <div className="p-3 rounded-xl bg-rose-950/70 border border-rose-500/60 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{publishError}</span>
            </div>
          )}

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              {/* Bespoke Generated Thumbnail Preview */}
              {lastVideo.thumbnailUrl ? (
                <div 
                  onClick={() => lastVideo.previewUrl && setShowVideoModal(true)}
                  className="relative group shrink-0 cursor-pointer"
                  title="Click to preview video"
                >
                  <img
                    src={lastVideo.thumbnailUrl}
                    alt="Video Thumbnail"
                    referrerPolicy="no-referrer"
                    className="w-32 h-20 sm:w-40 sm:h-24 object-cover rounded-xl border border-emerald-500/40 shadow-lg group-hover:scale-105 transition-transform"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded-xl">
                    <Play className="w-8 h-8 text-white fill-white drop-shadow" />
                  </div>
                  <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/80 text-[10px] font-black text-amber-300">
                    THUMBNAIL
                  </span>
                </div>
              ) : (
                <div 
                  onClick={() => lastVideo.previewUrl && setShowVideoModal(true)}
                  className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0 cursor-pointer hover:bg-emerald-500/30"
                >
                  <Play className="w-6 h-6 text-emerald-300 fill-emerald-300" />
                </div>
              )}

              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    lastVideo.youtubeUrl ? "bg-emerald-500/20 text-emerald-300" : "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                  }`}>
                    {lastVideo.youtubeUrl ? "Published on YouTube ✅" : "Ready for Review (Local Preview) 🎬"}
                  </span>
                  <span className="text-xs text-slate-400">{lastVideo.format}</span>
                  {lastVideo.durationSeconds && (
                    <span className="text-xs text-slate-400">• {Math.floor(lastVideo.durationSeconds / 60)}m {lastVideo.durationSeconds % 60}s</span>
                  )}
                  {lastVideo.seoAnalysis?.predictedCTR && (
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-black border border-amber-500/30 flex items-center gap-1">
                      <Zap className="w-3 h-3 text-amber-400 fill-amber-400" />
                      {lastVideo.seoAnalysis.predictedCTR}% CTR Verified
                    </span>
                  )}
                </div>

                <h3 className="text-base font-bold text-white mt-1 line-clamp-1">
                  {lastVideo.title || "Generated Video"}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {lastVideo.youtubeUrl 
                    ? "Generated with bespoke high-CTR thumbnail, ElevenLabs voice narration & dynamic captions."
                    : "Video generated successfully! You can preview/watch it first below before confirming upload to YouTube."}
                </p>
              </div>
            </div>

            {/* Action Buttons: Preview Video, Thumbnail Download, Video Download, YouTube Upload */}
            <div className="flex items-center gap-2 flex-wrap shrink-0">
              {lastVideo.previewUrl && (
                <button
                  onClick={() => setShowVideoModal(true)}
                  className="px-3.5 py-2 rounded-xl bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-200 text-xs font-bold border border-cyan-500/50 transition-all flex items-center gap-1.5 cursor-pointer shadow-lg shadow-cyan-950/40"
                >
                  <Play className="w-3.5 h-3.5 fill-cyan-200" />
                  <span>Watch / Review Video</span>
                </button>
              )}

              {lastVideo.thumbnailDownloadUrl && (
                <a
                  href={lastVideo.thumbnailDownloadUrl}
                  download="thumbnail.jpg"
                  className="px-3.5 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-bold border border-amber-500/40 transition-all flex items-center gap-1.5"
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                  <span>Download Thumbnail</span>
                </a>
              )}

              {lastVideo.previewUrl && (
                <a
                  href={lastVideo.previewUrl}
                  download="autotube_video.mp4"
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 transition-all flex items-center gap-1.5"
                >
                  <Film className="w-3.5 h-3.5" />
                  <span>Download MP4</span>
                </a>
              )}

              {/* Upload to YouTube Button (when not yet uploaded, or re-upload) */}
              {!lastVideo.youtubeUrl ? (
                <button
                  onClick={() => lastVideo.id && handleManualUpload(lastVideo.id)}
                  disabled={isPublishing}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white text-xs font-black shadow-lg shadow-red-600/40 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  title="Upload this reviewed video to your YouTube channel"
                >
                  {isPublishing ? (
                    <>
                      <Activity className="w-3.5 h-3.5 animate-spin" />
                      <span>Uploading to YouTube...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload to YouTube 🚀</span>
                    </>
                  )}
                </button>
              ) : (
                <a
                  href={lastVideo.youtubeUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-lg shadow-red-600/30 transition-all flex items-center gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Watch on YouTube</span>
                </a>
              )}
            </div>
          </div>

          {/* In-App Inline Video Player Review Drawer */}
          {showVideoModal && lastVideo.previewUrl && (
            <div className="mt-4 p-4 rounded-xl bg-black/80 border border-cyan-500/40 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Play className="w-4 h-4 text-cyan-400 fill-cyan-400" />
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    Video Player Review ({lastVideo.title || "Match Documentary"})
                  </span>
                </div>
                <button
                  onClick={() => setShowVideoModal(false)}
                  className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded bg-slate-800"
                >
                  ✕ Close Player
                </button>
              </div>
              <div className={`mx-auto rounded-lg overflow-hidden bg-black border border-slate-800 shadow-2xl ${
                lastVideo.format?.includes("16:9")
                  ? "aspect-video max-w-2xl"
                  : "aspect-[9/16] max-w-[320px] max-h-[70vh]"
              }`}>
                <video
                  src={lastVideo.previewUrl}
                  controls
                  autoPlay
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="flex items-center justify-between text-xs text-slate-300 pt-1">
                <span>Video review karke check karein ke sab kuch theek hai.</span>
                {!lastVideo.youtubeUrl && (
                  <button
                    onClick={() => {
                      if (lastVideo.id) handleManualUpload(lastVideo.id);
                    }}
                    disabled={isPublishing}
                    className="px-3.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                  >
                    <Upload className="w-3 h-3" />
                    <span>Ab YouTube Par Upload Karo</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
