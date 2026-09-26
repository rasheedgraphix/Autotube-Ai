import React, { useState, useEffect } from "react";
import {
  Sparkles,
  Play,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  BarChart3,
  Video,
  ExternalLink,
  RefreshCw,
  Zap,
  Terminal,
  Film,
  Download,
  Sliders,
  Radio,
  Check,
} from "lucide-react";

interface CategoryCTRMetric {
  id: string;
  name: string;
  niche: string;
  ctrPercent: number;
  impressions: number;
  views: number;
  trend: "rising" | "stable" | "hot";
  description: string;
  sampleHook: string;
}

interface SchedulerStatusData {
  mode: string;
  active: boolean;
  autoSchedule: boolean;
  scheduleDescription: string;
  hasConnectedChannel: boolean;
  connectedChannelTitle: string | null;
  httpEndpoint: string;
}

interface PipelineRunLog {
  id: string;
  timestamp: string;
  status: "success" | "failed" | "running";
  category: {
    id: string;
    name: string;
    ctrPercent: number;
    impressions: number;
    views: number;
  };
  script: {
    title: string;
    description: string;
    tags: string[];
    hashtags: string[];
    scenes: Array<{
      badge?: string;
      title: string;
      body: string;
      highlight?: string;
      durationSeconds?: number;
    }>;
  };
  video?: {
    sizeBytes: number;
    durationSeconds: number;
    previewUrl?: string;
  };
  youtube?: {
    videoId: string;
    videoUrl: string;
    embedUrl: string;
    privacyStatus: string;
  };
  logs: Array<{ step: string; message: string; timestamp: string }>;
  error?: string;
}

interface Props {
  connectedToken: string | null;
  channelTitle?: string | null;
  onConnectChannel: () => void;
  initialFormat?: "short" | "long";
}

export default function SchedulerSection({
  connectedToken,
  channelTitle,
  onConnectChannel,
  initialFormat = "short",
}: Props) {
  const [videoFormat, setVideoFormat] = useState<"short" | "long">(initialFormat);
  const [schedulerStatus, setSchedulerStatus] = useState<SchedulerStatusData | null>(null);
  const [categories, setCategories] = useState<CategoryCTRMetric[]>([]);
  const [topCategory, setTopCategory] = useState<CategoryCTRMetric | null>(null);
  const [analyticsSource, setAnalyticsSource] = useState<string>("YouTube Analytics API v2");

  const [isRunningPipeline, setIsRunningPipeline] = useState(false);
  const [currentStep, setCurrentStep] = useState<string>("idle");
  const [liveLogs, setLiveLogs] = useState<Array<{ step: string; message: string; timestamp: string }>>([]);
  const [lastExecution, setLastExecution] = useState<PipelineRunLog | null>(null);
  const [history, setHistory] = useState<PipelineRunLog[]>([]);

  const [selectedPrivacy, setSelectedPrivacy] = useState<"public" | "unlisted" | "private">("public");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("auto");
  const [customTopic, setCustomTopic] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Sync format if initialFormat changes
  useEffect(() => {
    if (initialFormat) {
      setVideoFormat(initialFormat);
    }
  }, [initialFormat]);

  // Load scheduler status & analytics data
  const refreshData = async () => {
    try {
      // 1. Fetch scheduler status
      const statusRes = await fetch("/api/scheduler/status");
      if (statusRes.ok) {
        const sData = await statusRes.json();
        if (sData.success) {
          setSchedulerStatus(sData.scheduler);
          if (sData.pipeline?.lastRun) {
            setLastExecution(sData.pipeline.lastRun);
            if (sData.pipeline.lastRun.status === "success") {
              setCurrentStep("done");
              if (Array.isArray(sData.pipeline.lastRun.logs) && sData.pipeline.lastRun.logs.length > 0) {
                setLiveLogs(sData.pipeline.lastRun.logs);
              }
            }
          }
          if (sData.pipeline?.history) {
            setHistory(sData.pipeline.history);
          }
        }
      }

      // 2. Fetch highest CTR fact categories
      const headers: Record<string, string> = {};
      if (connectedToken) {
        headers["Authorization"] = `Bearer ${connectedToken}`;
      }
      const catRes = await fetch("/api/analytics/categories", { headers });
      if (catRes.ok) {
        const cData = await catRes.json();
        if (cData.success && cData.data) {
          setCategories(cData.data.categories || []);
          setTopCategory(cData.data.topCategory || null);
          setAnalyticsSource(cData.data.source || "YouTube Analytics API v2");
        }
      }
    } catch (err) {
      console.warn("Status fetch warning:", err);
    }
  };

  useEffect(() => {
    refreshData();
    const interval = setInterval(refreshData, 30000);
    return () => clearInterval(interval);
  }, [connectedToken]);

  // Trigger manual pipeline run
  const triggerPipeline = async (explicitFormat?: "short" | "long") => {
    const activeFormat = explicitFormat || videoFormat;
    setIsRunningPipeline(true);
    setErrorMsg(null);
    setCurrentStep("analytics");
    const previousRunId = lastExecution?.id || null;
    const triggerStartTime = Date.now();

    setLiveLogs([
      {
        step: "analytics",
        message: `Starting automated pipeline for ${activeFormat === "long" ? "16:9 Widescreen Long Video (8+ Min Documentary)" : "9:16 Vertical Short (2+ Min)"}. Querying YouTube Analytics API for highest CTR topic...`,
        timestamp: new Date().toLocaleTimeString(),
      },
    ]);

    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (connectedToken) {
        headers["Authorization"] = `Bearer ${connectedToken}`;
      }

      const res = await fetch("/api/scheduler/daily-run", {
        method: "POST",
        headers,
        body: JSON.stringify({
          privacyStatus: selectedPrivacy,
          categoryId: selectedCategoryId === "auto" || selectedCategoryId === "custom" ? undefined : selectedCategoryId,
          overrideNiche: selectedCategoryId === "custom" ? customTopic : undefined,
          videoFormat: activeFormat,
        }),
      });

      const text = await res.text();
      let data: any = null;
      try {
        data = JSON.parse(text);
      } catch {
        console.warn("Non-JSON response received, proceeding to poll pipeline status...");
      }

      if (data && data.success === false) {
        throw new Error(data.error || "Manual pipeline failed to start.");
      }

      // Wait a moment for pipeline to initialize in-memory logs
      await new Promise((r) => setTimeout(r, 1200));

      // Active live polling loop for continuous progress updates (up to 10 minutes)
      let completed = false;
      const maxPollSeconds = 600;
      const startTime = Date.now();

      while ((Date.now() - startTime) / 1000 < maxPollSeconds) {
        await new Promise((r) => setTimeout(r, 1200));

        try {
          const sRes = await fetch("/api/scheduler/status");
          if (!sRes.ok) continue;

          const sData = await sRes.json();
          const pipe = sData.pipeline;
          if (!pipe) continue;

          // Update live step and logs while running
          if (pipe.currentStep && pipe.currentStep !== "idle") {
            setCurrentStep(pipe.currentStep);
          }
          if (Array.isArray(pipe.activeLogs) && pipe.activeLogs.length > 0) {
            setLiveLogs(pipe.activeLogs);
          }

          // Check if pipeline has finished
          if (pipe.isRunning === false) {
            const last = pipe.lastRun;
            // Ensure this is the new run (either new run ID or executed after we triggered)
            const isNewRun = last && (last.id !== previousRunId || new Date(last.timestamp).getTime() >= triggerStartTime - 5000);

            if (isNewRun && last.status === "success") {
              setLastExecution(last);
              if (last.logs && last.logs.length > 0) {
                setLiveLogs(last.logs);
              }
              setCurrentStep("done");
              refreshData();
              completed = true;
              break;
            } else if (isNewRun && last.status === "failed") {
              throw new Error(last.error || "Pipeline execution failed.");
            }
          }
        } catch (pollErr: any) {
          if (pollErr.message && !pollErr.message.includes("fetch")) {
            throw pollErr;
          }
        }
      }

      if (!completed) {
        refreshData();
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to run automated pipeline.");
      setCurrentStep("failed");
    } finally {
      setIsRunningPipeline(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner: Manual Trigger Control Center with Format Selection */}
      <div className="p-6 md:p-8 rounded-3xl bg-gradient-to-br from-slate-900/95 via-slate-900/90 to-red-950/40 border border-slate-800/90 hover:border-slate-700/80 shadow-2xl shadow-black/60 relative overflow-hidden backdrop-blur-xl">
        {/* Subtle Ambient Glow Orbs */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-red-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col gap-6 relative z-10">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs text-slate-400 font-semibold mb-1">
                <span>Autonomous Studio</span>
                <span aria-hidden="true">·</span>
                <span>Veo 3 + ElevenLabs</span>
              </div>

              <h2 className="text-xl font-bold tracking-tight text-white">
                Automated Video Production
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 max-w-2xl leading-relaxed mt-1">
                High-retention 9:16 Shorts ya comprehensive 8+ Minute Long Documentary select karein. Verified scripts, cinematic visuals aur ElevenLabs voiceover YouTube par publish hote hain.
              </p>
            </div>
          </div>

          {/* Video Format Choice Selector Tabs */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-2">
            {/* Format 1: 2+ Min Extended Shorts */}
            <div
              onClick={() => setVideoFormat("short")}
              className={`p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden ${
                videoFormat === "short"
                  ? "bg-gradient-to-r from-red-950/70 via-slate-900 to-slate-900 border-red-500 ring-2 ring-red-500/40 shadow-xl"
                  : "bg-slate-950/60 border-slate-800/80 hover:border-slate-700 opacity-80 hover:opacity-100"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-base shrink-0 ${
                    videoFormat === "short" ? "bg-red-600 text-white shadow-lg shadow-red-900/60" : "bg-slate-800 text-slate-300"
                  }`}>
                    ⚡
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white">YouTube Shorts Mode</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-red-600 text-white">
                        9:16 Vertical • 2+ Min (Extended Fact)
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 mt-1">
                      Deep-dive viral fact short (2+ minutes, 120s+) with 11 dynamic scenes, complete storytelling from hook to conclusion, Hormozi lower-third subtitles, and subscribe CTA.
                    </p>
                  </div>
                </div>
                {videoFormat === "short" && (
                  <span className="px-2 py-1 rounded-md text-[10px] font-bold bg-red-600/20 text-red-300 border border-red-500/40 shrink-0">
                    ACTIVE
                  </span>
                )}
              </div>
            </div>

            {/* Format 2: 8+ Min Long Video */}
            <div
              onClick={() => setVideoFormat("long")}
              className={`p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden ${
                videoFormat === "long"
                  ? "bg-gradient-to-r from-amber-950/70 via-slate-900 to-slate-900 border-amber-500 ring-2 ring-amber-500/40 shadow-xl"
                  : "bg-slate-950/60 border-slate-800/80 hover:border-slate-700 opacity-80 hover:opacity-100"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-base shrink-0 ${
                    videoFormat === "long" ? "bg-gradient-to-br from-amber-500 to-red-600 text-slate-950 shadow-lg shadow-amber-950/60" : "bg-slate-800 text-slate-300"
                  }`}>
                    🎬
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white">Long Video Documentary</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-slate-950">
                        16:9 Widescreen • 8+ Minutes
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 mt-1">
                      16 deep chronological chapters, rich narrative voiceover, cinematic documentary overlays, and YouTube chapter timestamps.
                    </p>
                  </div>
                </div>
                {videoFormat === "long" && (
                  <span className="px-2 py-1 rounded-md text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 shrink-0">
                    ACTIVE
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Topic & Privacy & Big Trigger Button Controls */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3 shrink-0 flex-wrap pt-2">
            {/* Category / Topic Selector */}
            <div className="flex flex-col gap-1.5 min-w-[210px] flex-1 sm:flex-none">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                <span>Topic / Niche</span>
                {selectedCategoryId === "auto" && (
                  <span className="text-[10px] text-amber-400 font-semibold">Auto (Top CTR)</span>
                )}
              </label>
              <select
                value={selectedCategoryId}
                onChange={(e) => setSelectedCategoryId(e.target.value)}
                className="bg-slate-950/90 border border-slate-700/90 hover:border-slate-600 text-xs font-semibold text-slate-200 rounded-xl px-3.5 py-3 focus:outline-none focus:border-red-500 transition-colors cursor-pointer shadow-inner"
                title="Select trending fact category or custom topic"
              >
                <option value="auto">🔥 Auto: Highest CTR Topic</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.ctrPercent}% CTR)
                  </option>
                ))}
                <option value="custom">✍️ Custom Topic / Query...</option>
              </select>
            </div>

            {/* Custom Topic Input if selected */}
            {selectedCategoryId === "custom" && (
              <div className="flex flex-col gap-1.5 min-w-[190px] flex-1 sm:flex-none">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Custom Topic Query
                </label>
                <input
                  type="text"
                  placeholder="e.g. Black Holes, Deep Ocean, Quantum Physics..."
                  value={customTopic}
                  onChange={(e) => setCustomTopic(e.target.value)}
                  className="bg-slate-950/90 border border-slate-700/90 hover:border-slate-600 text-xs text-white rounded-xl px-3.5 py-3 focus:outline-none focus:border-red-500 transition-colors shadow-inner"
                />
              </div>
            )}

            {/* Privacy Selector */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Upload Privacy
              </label>
              <select
                value={selectedPrivacy}
                onChange={(e) => setSelectedPrivacy(e.target.value as any)}
                className="bg-slate-950/90 border border-slate-700/90 hover:border-slate-600 text-xs font-semibold text-slate-200 rounded-xl px-3.5 py-3 focus:outline-none focus:border-red-500 transition-colors cursor-pointer shadow-inner"
                title="Privacy for auto-uploaded video"
              >
                <option value="public">🌐 Public</option>
                <option value="unlisted">🔗 Unlisted</option>
                <option value="private">🔒 Private</option>
              </select>
            </div>

            {/* Main Action Trigger Button */}
            <div className="flex flex-col gap-1.5 flex-1 sm:flex-none">
              <button
                onClick={() => triggerPipeline()}
                disabled={isRunningPipeline || (selectedCategoryId === "custom" && !customTopic.trim())}
                className={`inline-flex items-center justify-center gap-3 px-8 py-3.5 rounded-xl text-white text-sm font-black uppercase tracking-wider shadow-xl transition-all disabled:opacity-60 disabled:pointer-events-none cursor-pointer ${
                  videoFormat === "long"
                    ? "bg-gradient-to-r from-amber-600 via-orange-500 to-red-600 hover:from-amber-500 hover:to-red-500 shadow-amber-950/60 hover:shadow-amber-900/50 hover:scale-[1.02] active:scale-[0.98]"
                    : "bg-gradient-to-r from-red-600 via-red-500 to-amber-500 hover:from-red-500 hover:to-amber-400 shadow-red-950/60 hover:shadow-red-900/50 hover:scale-[1.02] active:scale-[0.98]"
                }`}
              >
                {isRunningPipeline ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    <span>
                      {videoFormat === "long" ? "Generating 8+ Min Long Video..." : "Generating 60-Sec Short..."}
                    </span>
                  </>
                ) : (
                  <>
                    <Play className="w-5 h-5 fill-white" />
                    <span>
                      {videoFormat === "long" ? "🎬 GENERATE & AUTO-UPLOAD LONG VIDEO (8+ MIN)" : "⚡ GENERATE & AUTO-UPLOAD SHORT (2+ MIN)"}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* OAuth Warning if channel is not connected */}
        {!connectedToken && (
          <div className="mt-6 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-amber-200 backdrop-blur-sm">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
              <span>
                <b>YouTube Channel Not Connected:</b> The pipeline will still generate scripts and render 2+ min videos locally, but direct YouTube uploading requires connecting your channel.
              </span>
            </div>
            <button
              onClick={onConnectChannel}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shrink-0 transition-colors shadow-md shadow-amber-950/30 cursor-pointer"
            >
              Connect YouTube Channel
            </button>
          </div>
        )}
      </div>

      {/* Error notification */}
      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-950/50 border border-red-800 text-red-200 text-xs flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
          <span className="flex-1 font-medium">{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="text-red-400 hover:text-red-200 font-bold px-2 py-1">
            Dismiss
          </button>
        </div>
      )}

      {/* Active Pipeline Stepper when running or finished */}
      {(isRunningPipeline || liveLogs.length > 0) && (
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Film className="w-4 h-4 text-red-500" />
              Pipeline Execution Stepper
            </h3>
            <span className="text-xs text-slate-400">
              Status:{" "}
              {isRunningPipeline ? (
                <b className="text-amber-400 animate-pulse">
                  {videoFormat === "long" ? "Generating 8+ Min Full HD Documentary with real narration..." : "Generating 60-sec video with real voice..."}
                </b>
              ) : currentStep === "failed" ? (
                <b className="text-red-400">Failed</b>
              ) : (
                <b className="text-emerald-400">Complete & Ready</b>
              )}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            {[
              { id: "analytics", label: "1. YouTube Analytics", desc: "Highest CTR Fact Topic" },
              {
                id: "gemini_script",
                label: "2. Gemini Scripting",
                desc: videoFormat === "long" ? "Documentary Script (16 Chapters)" : "Viral Title, 15 Tags & 11 Scenes",
              },
              {
                id: "video_render",
                label: videoFormat === "long" ? "3. 16:9 Long Video + Voice" : "3. 2+ Min Video + Voice",
                desc: videoFormat === "long" ? "16 Chapters (8+ Min), Narrator, Subtitles" : "Veo 3, ElevenLabs, Hormozi Captions (11 Scenes)",
              },
              { id: "youtube_upload", label: "4. YouTube Upload", desc: "Direct Resumable Upload" },
            ].map((st) => {
              const isCurrent = currentStep === st.id && isRunningPipeline;
              const isDone =
                currentStep === "done" ||
                (st.id === "analytics" && ["gemini_script", "video_render", "youtube_upload", "done"].includes(currentStep)) ||
                (st.id === "gemini_script" && ["video_render", "youtube_upload", "done"].includes(currentStep)) ||
                (st.id === "video_render" && ["youtube_upload", "done"].includes(currentStep)) ||
                (st.id === "youtube_upload" && currentStep === "done");

              return (
                <div
                  key={st.id}
                  className={`p-3.5 rounded-xl border transition-all ${
                    isCurrent
                      ? "bg-red-950/40 border-red-500 shadow-md shadow-red-950"
                      : isDone
                      ? "bg-slate-950/80 border-emerald-500/40"
                      : "bg-slate-950/40 border-slate-800 text-slate-500"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    {isDone ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : isCurrent ? (
                      <RefreshCw className="w-4 h-4 text-red-400 animate-spin shrink-0" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border border-slate-700 shrink-0" />
                    )}
                    <span className={`text-xs font-bold ${isCurrent ? "text-red-300" : isDone ? "text-emerald-300" : "text-slate-400"}`}>
                      {st.label}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 pl-6">{st.desc}</p>
                </div>
              );
            })}
          </div>

          {/* Live Pipeline Terminal Logs */}
          <div className="bg-slate-950 rounded-xl p-3.5 border border-slate-800 font-mono text-xs text-slate-300 max-h-48 overflow-y-auto space-y-1.5">
            <div className="text-[11px] text-slate-500 mb-1 flex items-center gap-1.5">
              <Terminal className="w-3 h-3 text-red-400" />
              Live Pipeline Logs:
            </div>
            {liveLogs.map((log, idx) => (
              <div key={idx} className="flex items-start gap-2">
                <span className="text-slate-500 text-[10px] shrink-0">[{log.timestamp}]</span>
                <span className="text-red-400 font-semibold uppercase text-[10px] shrink-0">[{log.step}]</span>
                <span className="text-slate-200">{log.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Latest Output Spotlight (Video Preview & Direct YouTube Shorts Link) */}
      {lastExecution && lastExecution.status === "success" && (
        <div className="p-6 md:p-8 rounded-2xl bg-slate-900 border-2 border-emerald-600/40 shadow-2xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-lg font-black text-white">Pipeline Execution Success</h3>
                  <span className={`px-2.5 py-0.5 rounded text-[11px] font-black border ${
                    lastExecution.youtube?.videoId
                      ? "bg-emerald-950 text-emerald-300 border-emerald-700"
                      : "bg-blue-950 text-blue-300 border-blue-700"
                  }`}>
                    {lastExecution.youtube?.videoId ? "UPLOADED TO YOUTUBE" : "VIDEO READY (OFFLINE)"}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Winning Topic: <b>{lastExecution.category.name}</b> ({lastExecution.category.ctrPercent}% CTR)
                </p>
              </div>
            </div>

            {/* Direct YouTube Link */}
            {lastExecution.youtube?.videoUrl && (
              <div className="flex items-center gap-2 flex-wrap">
                <a
                  href={lastExecution.youtube.videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs shadow-lg shadow-red-950 transition-all hover:scale-105 shrink-0"
                >
                  <ExternalLink className="w-4 h-4" />
                  {lastExecution.video && lastExecution.video.durationSeconds > 100
                    ? "Open YouTube Long Video"
                    : "Open YouTube Short"}
                </a>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Video Player Preview */}
            {(() => {
              const isWidescreenVideo = Boolean(
                (lastExecution.video as any)?.aspectRatio === "16:9" ||
                (lastExecution.video as any)?.format?.includes("16:9") ||
                (lastExecution.video && lastExecution.video.durationSeconds >= 350)
              );
              return (
                <div className={`flex flex-col items-center ${
                  isWidescreenVideo ? "lg:col-span-6" : "lg:col-span-5"
                }`}>
                  <div className={`w-full rounded-2xl bg-black border-2 border-slate-700 overflow-hidden shadow-2xl relative group ${
                    isWidescreenVideo
                      ? "aspect-[16/9] max-w-[480px]"
                      : "aspect-[9/16] max-w-[300px]"
                  }`}>
                    {lastExecution.video?.previewUrl ? (
                      <video
                        src={lastExecution.video.previewUrl}
                        controls
                        autoPlay
                        loop
                        playsInline
                        className="w-full h-full object-contain bg-black"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center text-slate-400">
                        <Video className="w-10 h-10 text-slate-600 mb-2" />
                        <span className="text-xs">Video Render Complete</span>
                      </div>
                    )}
                  </div>
                  <div className="mt-3 text-center space-y-2">
                    <div className="text-xs text-slate-400">
                      <span className="font-semibold text-slate-300">Format:</span>{" "}
                      {isWidescreenVideo
                        ? "16:9 Widescreen Long Video"
                        : "9:16 Vertical Shorts (Full HD)"}{" "}
                      • <span className="font-semibold text-slate-300">Duration:</span>{" "}
                      {lastExecution.video?.durationSeconds
                        ? lastExecution.video.durationSeconds > 60
                          ? `${Math.floor(lastExecution.video.durationSeconds / 60)}m ${lastExecution.video.durationSeconds % 60}s`
                          : `${lastExecution.video.durationSeconds}s`
                        : "2+ Min"}{" "}
                      • <span className="font-semibold text-slate-300">Size:</span>{" "}
                      {((lastExecution.video?.sizeBytes || 0) / (1024 * 1024)).toFixed(1)} MB
                    </div>
                    {lastExecution.video?.previewUrl && (
                      <a
                        href={lastExecution.video.previewUrl}
                        download={`autotube_${isWidescreenVideo ? "long_documentary" : "viral_short"}_${lastExecution.id || "render"}.mp4`}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 shadow-sm transition-colors"
                      >
                        <Download className="w-3.5 h-3.5 text-red-400" />
                        Download {isWidescreenVideo ? "8+ Min Documentary MP4" : "2+ Min Master MP4"}
                      </a>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Generated Metadata Card */}
            <div className={`space-y-4 ${
              lastExecution.video && lastExecution.video.durationSeconds > 100 ? "lg:col-span-6" : "lg:col-span-7"
            }`}>
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Video Title</span>
                <div className="text-base font-bold text-white mt-1 p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                  {lastExecution.script.title}
                </div>
              </div>

              {lastExecution.youtube?.videoUrl && (
                <div>
                  <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">YouTube Watch Link</span>
                  <div className="text-sm font-mono text-slate-200 mt-1 p-3 rounded-xl bg-slate-950 border border-emerald-800/40 flex items-center justify-between">
                    <a
                      href={lastExecution.youtube.videoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-red-400 hover:underline truncate"
                    >
                      {lastExecution.youtube.videoUrl}
                    </a>
                  </div>
                </div>
              )}

              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Description</span>
                <div className="text-xs text-slate-300 mt-1 p-3 rounded-xl bg-slate-950 border border-slate-800 max-h-36 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                  {lastExecution.script.description}
                </div>
              </div>

              {/* Tags & Hashtags */}
              <div className="space-y-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Generated SEO Tags ({lastExecution.script.tags?.length || 0})
                </span>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                  {lastExecution.script.tags?.map((tg, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 text-[11px] border border-slate-700"
                    >
                      {tg}
                    </span>
                  ))}
                </div>
              </div>

              {/* Hashtags */}
              <div className="flex flex-wrap gap-1.5">
                {lastExecution.script.hashtags?.map((ht, i) => (
                  <span
                    key={i}
                    className="px-2.5 py-0.5 rounded-full bg-red-950/60 text-red-400 text-xs font-semibold border border-red-800/40"
                  >
                    {ht}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Analytics CTR Leaderboard */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-red-600/20 text-red-400 flex items-center justify-center">
              <BarChart3 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">YouTube Analytics API • High CTR Topics</h3>
              <p className="text-[11px] text-slate-400">Live topics dynamically ranked & rotated in real-time for maximum viral potential</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => refreshData()}
              className="px-2.5 py-1 rounded-full bg-red-950/60 hover:bg-red-900/80 text-red-300 hover:text-white border border-red-800/50 text-[11px] font-semibold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
              title="Rotate & fetch fresh real-time trending topics"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Rotate Live Topics</span>
            </button>
            <span className="text-[11px] px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
              Source: {analyticsSource}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {categories.map((cat, idx) => {
            const isTop = idx === 0;
            const isSelected = selectedCategoryId === cat.id || (selectedCategoryId === "auto" && isTop);
            return (
              <div
                key={cat.id}
                onClick={() => setSelectedCategoryId(cat.id)}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                  isSelected
                    ? "bg-gradient-to-r from-red-950/60 to-slate-900 border-red-500 ring-2 ring-red-500/30 shadow-lg"
                    : isTop
                    ? "bg-gradient-to-r from-red-950/30 to-slate-900 border-red-800/60 hover:border-red-600"
                    : "bg-slate-950/60 border-slate-800/80 hover:border-slate-600"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <span
                      className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${
                        isSelected ? "bg-red-600 text-white" : isTop ? "bg-red-900 text-red-200" : "bg-slate-800 text-slate-400"
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-white">{cat.name}</span>
                        {isTop && (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-black bg-red-600 text-white">
                            #1 TOP CTR
                          </span>
                        )}
                        {isSelected && (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                            SELECTED
                          </span>
                        )}
                        <span className="text-[10px] text-slate-400">({cat.niche})</span>
                      </div>
                      <p className="text-[11px] text-slate-300 mt-0.5 line-clamp-1">{cat.description}</p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-sm font-black text-amber-400 flex items-center justify-end gap-1">
                      <TrendingUp className="w-3 h-3 text-amber-400" />
                      {cat.ctrPercent}% CTR
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {cat.views.toLocaleString()} views
                    </div>
                  </div>
                </div>

                {/* Visual CTR Bar */}
                <div className="w-full bg-slate-800 rounded-full h-1.5 mt-2 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${isSelected ? "bg-red-500" : isTop ? "bg-red-600/70" : "bg-slate-500"}`}
                    style={{ width: `${Math.min(100, cat.ctrPercent * 6)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
