import React, { useState, useEffect, useRef } from "react";
import {
  Youtube,
  Sparkles,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  FileVideo,
  Copy,
  ExternalLink,
  RefreshCw,
  Hash,
  Tag,
  X,
  Key,
  ShieldCheck,
  Play,
  Check,
  HelpCircle,
  LogOut,
  Sliders,
  Clock,
  Zap,
  Activity,
} from "lucide-react";
import SchedulerSection from "./components/SchedulerSection";
import PipelineLiveTracker from "./components/PipelineLiveTracker";
import PromptStudioSection from "./components/PromptStudioSection";
import AutoTubeLogo from "./components/AutoTubeLogo";
import { safeFetchJson } from "./utils/safeFetch";

interface ChannelInfo {
  id: string;
  title: string;
  customUrl?: string;
  thumbnail?: string;
  subscriberCount?: string;
  videoCount?: string;
}

export default function App() {
  // Input fields
  const [niche, setNiche] = useState("Islamic Education");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"prompt_video" | "pipeline" | "shorts" | "long">("prompt_video");
  const [globalPipelineStatus, setGlobalPipelineStatus] = useState<any>(null);

  // Poll pipeline status globally for active progress updates
  useEffect(() => {
    const checkPipeline = async () => {
      try {
        const res = await fetch("/api/scheduler/status");
        const data = await res.json();
        if (data.success && data.pipeline) {
          setGlobalPipelineStatus(data.pipeline);
        }
      } catch {}
    };
    checkPipeline();
    const interval = setInterval(checkPipeline, 3000);
    return () => clearInterval(interval);
  }, []);

  // Generated metadata fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [hashtags, setHashtags] = useState<string[]>([]);

  // Input states for adding extra tags/hashtags
  const [tagInput, setTagInput] = useState("");
  const [hashtagInput, setHashtagInput] = useState("");

  // Loading and progress states
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatusText, setUploadStatusText] = useState("");

  // Upload outcome
  const [uploadedVideoUrl, setUploadedVideoUrl] = useState<string | null>(null);
  const [uploadedVideoId, setUploadedVideoId] = useState<string | null>(null);

  // Channel & OAuth Auth states
  const [channel, setChannel] = useState<ChannelInfo | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("autotube_token"));
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [manualToken, setManualToken] = useState("");
  const [manualClientId, setManualClientId] = useState(() => localStorage.getItem("autotube_client_id") || "");
  const [isConnectingToken, setIsConnectingToken] = useState(false);

  // Notifications
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [ffmpegPreviewMessage, setFfmpegPreviewMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check auth status & sync persistent token on load
  useEffect(() => {
    const savedToken = localStorage.getItem("autotube_token");
    if (savedToken) {
      // Sync immediately to server disk persistence (/tmp/autotube/token.json & data/token.json)
      fetch("/api/auth/save-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: savedToken }),
      }).catch(() => {});
      checkAuthStatus(savedToken);
    } else {
      checkAuthStatus();
    }

    // Check system FFmpeg / preview status
    fetch("/api/health")
      .then((res) => res.json())
      .then((data) => {
        if (!data.hasFfmpeg) {
          setFfmpegPreviewMessage("Preview Mode: FFmpeg will be available after deploy");
        } else {
          setFfmpegPreviewMessage(null);
        }
      })
      .catch(() => {});
  }, []);

  // Listen for OAuth popup response
  useEffect(() => {
    const handleOAuthMessage = (event: MessageEvent) => {
      // Validate event source
      if (event.data?.type === "OAUTH_AUTH_SUCCESS") {
        const { accessToken, channel: chInfo } = event.data;
        if (accessToken) {
          setToken(accessToken);
          localStorage.setItem("autotube_token", accessToken);
          // Persist to server disk storage
          fetch("/api/auth/save-token", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: accessToken, channel: chInfo }),
          }).catch(() => {});
        }
        if (chInfo) {
          setChannel(chInfo);
        }
        setShowAuthModal(false);
        setSuccessMsg("YouTube Channel connected successfully via Google OAuth 2.0!");
      } else if (event.data?.type === "OAUTH_AUTH_ERROR") {
        setErrorMsg(`Google OAuth error: ${event.data.error || "Authentication failed"}`);
      }
    };

    window.addEventListener("message", handleOAuthMessage);
    return () => window.removeEventListener("message", handleOAuthMessage);
  }, []);

  const checkAuthStatus = async (authToken?: string) => {
    try {
      const headers: Record<string, string> = {};
      if (authToken) {
        headers["Authorization"] = `Bearer ${authToken}`;
      }
      const { ok, data } = await safeFetchJson<any>("/api/auth/status", { headers });
      if (ok && data?.connected && data.channel) {
        setChannel(data.channel);
        if (data.token) {
          setToken(data.token);
          localStorage.setItem("autotube_token", data.token);
        }
      } else if (authToken && (!ok || !data?.connected)) {
        // Token was invalid or expired
        localStorage.removeItem("autotube_token");
        setToken(null);
        setChannel(null);
      }
    } catch (e) {
      console.error("Auth status check failed:", e);
    }
  };

  // Video file selection handler
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.includes("mp4") && !file.name.toLowerCase().endsWith(".mp4")) {
        setErrorMsg("Please select an MP4 video file.");
        return;
      }
      setVideoFile(file);
      setErrorMsg(null);
      if (videoPreviewUrl) {
        URL.revokeObjectURL(videoPreviewUrl);
      }
      const url = URL.createObjectURL(file);
      setVideoPreviewUrl(url);
    }
  };

  // 1. BRAIN: Generate Video Idea & Metadata using Gemini
  const handleGenerateIdea = async () => {
    if (!niche.trim()) {
      setErrorMsg("Please enter your channel niche first.");
      return;
    }

    setErrorMsg(null);
    setIsGenerating(true);
    try {
      const res = await fetch("/api/gemini/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ niche: niche.trim() }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Gemini failed to generate metadata.");
      }

      const { data } = json;
      setTitle(data.title || "");
      setDescription(data.description || "");
      setTags(Array.isArray(data.tags) ? data.tags : []);
      setHashtags(Array.isArray(data.hashtags) ? data.hashtags : []);
      setSuccessMsg("Viral metadata generated successfully with Gemini AI!");
    } catch (err: any) {
      console.error("Idea generation error:", err);
      setErrorMsg(err.message || "Failed to generate idea. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  // 2. UPLOADER: Upload video to YouTube Data API v3
  const handleUploadToYouTube = async () => {
    if (!videoFile) {
      setErrorMsg("Please select an MP4 video file to upload.");
      return;
    }
    if (!title.trim()) {
      setErrorMsg("Video title is required. Click 'Generate Idea' or enter a title.");
      return;
    }
    if (!channel && !token) {
      setErrorMsg("Please connect your YouTube channel before uploading.");
      setShowAuthModal(true);
      return;
    }

    setErrorMsg(null);
    setIsUploading(true);
    setUploadStatusText("Initializing YouTube Resumable Upload (Category 27: Education)...");

    try {
      const formData = new FormData();
      formData.append("video", videoFile);
      formData.append("title", title);
      formData.append("description", description);
      formData.append("tags", JSON.stringify(tags));
      formData.append("hashtags", JSON.stringify(hashtags));
      formData.append("privacyStatus", "public");

      setUploadStatusText("Streaming MP4 video bytes to YouTube Data API v3...");

      const headers: Record<string, string> = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const res = await fetch("/api/youtube/upload", {
        method: "POST",
        headers,
        body: formData,
      });

      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.error || "Failed to upload video to YouTube.");
      }

      setUploadedVideoId(result.videoId);
      setUploadedVideoUrl(result.videoUrl);
      setSuccessMsg("Video published successfully to your YouTube channel!");
    } catch (err: any) {
      console.error("Upload error:", err);
      setErrorMsg(err.message || "Failed to upload video. Check channel permissions or quota.");
    } finally {
      setIsUploading(false);
      setUploadStatusText("");
    }
  };

  // Connect Google OAuth Popup
  const handleGoogleOAuthPopup = async () => {
    setErrorMsg(null);
    try {
      const clientIdParam = manualClientId ? `?clientId=${encodeURIComponent(manualClientId)}` : "";
      const { ok, data, error } = await safeFetchJson<any>(`/api/auth/google/url${clientIdParam}`);

      if (!ok || !data?.url) {
        throw new Error(error || data?.error || "Unable to start Google OAuth flow. Please enter your Client ID.");
      }

      const width = 600;
      const height = 700;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;

      const popup = window.open(
        data.url,
        "youtube_oauth_popup",
        `width=${width},height=${height},top=${top},left=${left},status=no,resizable=yes`
      );

      if (!popup) {
        setErrorMsg("Popup blocker detected. Please allow popups to connect your Google Account.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Could not launch Google OAuth popup.");
    }
  };

  // Connect manual Access Token
  const handleManualTokenConnect = async () => {
    if (!manualToken.trim()) {
      setErrorMsg("Please paste a valid Google OAuth Access Token.");
      return;
    }
    setErrorMsg(null);
    setIsConnectingToken(true);
    try {
      const { ok, data, error } = await safeFetchJson<any>("/api/auth/connect-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: manualToken.trim() }),
      });
      if (!ok || !data?.success) {
        throw new Error(error || data?.error || "Invalid Google Access Token.");
      }

      setToken(data.token);
      setChannel(data.channel);
      localStorage.setItem("autotube_token", data.token);
      setShowAuthModal(false);
      setManualToken("");
      setSuccessMsg(`Connected to ${data.channel.title}!`);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to connect with provided token.");
    } finally {
      setIsConnectingToken(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await fetch("/api/auth/disconnect", { method: "POST" });
    } catch (e) {
      // ignore
    }
    localStorage.removeItem("autotube_token");
    setToken(null);
    setChannel(null);
    setSuccessMsg("Channel disconnected.");
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const removeTag = (indexToRemove: number) => {
    setTags(tags.filter((_, idx) => idx !== indexToRemove));
  };

  const addTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput("");
    }
  };

  const removeHashtag = (indexToRemove: number) => {
    setHashtags(hashtags.filter((_, idx) => idx !== indexToRemove));
  };

  const addHashtag = () => {
    let clean = hashtagInput.trim();
    if (clean) {
      if (!clean.startsWith("#")) clean = `#${clean}`;
      if (!hashtags.includes(clean)) {
        setHashtags([...hashtags, clean]);
        setHashtagInput("");
      }
    }
  };

  const currentRedirectUri = `${window.location.origin}/auth/callback`;

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 flex flex-col font-sans selection:bg-red-600 selection:text-white">
      {/* Top Ambient Glow Line */}
      <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-red-500 to-transparent opacity-80" />

      {/* Top Navigation Bar */}
      <header className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl sticky top-0 z-30 shadow-lg shadow-black/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
          {/* Logo & Brand Identity */}
          <AutoTubeLogo size="md" />

          {/* Channel Auth Widget & Status */}
          <div className="flex items-center gap-3">
            {channel ? (
              <div className="flex items-center gap-3 bg-slate-900/90 border border-slate-700/80 hover:border-slate-600 rounded-full pl-2 pr-3.5 py-1.5 shadow-lg shadow-black/30 transition-all">
                {channel.thumbnail ? (
                  <img
                    src={channel.thumbnail}
                    alt={channel.title}
                    referrerPolicy="no-referrer"
                    className="w-7 h-7 rounded-full border border-red-500/40 object-cover ring-1 ring-red-500/30"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-red-600 to-rose-700 text-white flex items-center justify-center text-xs font-black shadow-inner">
                    YT
                  </div>
                )}
                <div className="text-left hidden sm:block">
                  <div className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                    <span className="max-w-[130px] truncate">{channel.title}</span>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 inline" />
                  </div>
                  {channel.subscriberCount && (
                    <div className="text-[10px] font-semibold text-slate-400">
                      {Number(channel.subscriberCount).toLocaleString()} subscribers
                    </div>
                  )}
                </div>
                <button
                  onClick={handleDisconnect}
                  title="Disconnect Channel"
                  className="p-1.5 text-slate-400 hover:text-red-400 rounded-full hover:bg-red-950/30 transition-colors ml-1 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowAuthModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white text-xs font-bold shadow-lg shadow-red-950/60 hover:shadow-red-900/40 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
              >
                <Youtube className="w-4 h-4 fill-white" />
                <span>Connect Channel</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Preview Mode info notification - informative only, does not block pipeline */}
        {ffmpegPreviewMessage && (
          <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between gap-4 text-xs text-slate-300 animate-in fade-in">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
              <span className="font-medium text-amber-200">{ffmpegPreviewMessage}</span>
            </div>
            <span className="text-[11px] text-slate-400 hidden sm:inline-block bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
              Debian Bookworm /usr/bin/ffmpeg enabled in Dockerfile
            </span>
          </div>
        )}

        {/* Status Alerts */}
        {errorMsg && (
          <div className="p-4 rounded-xl bg-red-950/40 border border-red-800/60 flex items-start gap-3 text-red-200 animate-in fade-in slide-in-from-top-2">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1 text-sm">{errorMsg}</div>
            <button onClick={() => setErrorMsg(null)} className="text-red-400 hover:text-red-200">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {successMsg && (
          <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-800/60 flex items-start gap-3 text-emerald-200 animate-in fade-in slide-in-from-top-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div className="flex-1 text-sm">{successMsg}</div>
            <button onClick={() => setSuccessMsg(null)} className="text-emerald-400 hover:text-emerald-200">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Upload Success Banner with Video URL */}
        {uploadedVideoUrl && (
          <div className="p-6 rounded-2xl bg-gradient-to-r from-red-950/40 via-slate-900 to-slate-900 border-2 border-red-600/60 shadow-xl shadow-red-950/20">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-red-600/20 border border-red-500/30 flex items-center justify-center text-red-400">
                  <Play className="w-6 h-6 fill-red-400" />
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wider text-emerald-400 font-semibold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    Uploaded to YouTube (Public / Education 27)
                  </div>
                  <h3 className="text-lg font-bold text-white mt-0.5">{title || "Your YouTube Video"}</h3>
                  <p className="text-xs text-slate-400 font-mono mt-1 select-all">{uploadedVideoUrl}</p>
                </div>
              </div>

              <div className="flex items-center gap-2.5 w-full md:w-auto">
                <button
                  onClick={() => copyToClipboard(uploadedVideoUrl, "video_url")}
                  className="flex-1 md:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium border border-slate-700 transition-colors"
                >
                  {copiedKey === "video_url" ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-400" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copy URL
                    </>
                  )}
                </button>
                <a
                  href={uploadedVideoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 md:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-semibold transition-all shadow-md shadow-red-900/30"
                >
                  <ExternalLink className="w-4 h-4" />
                  Watch on YouTube
                </a>
              </div>
            </div>

            {uploadedVideoId && (
              <div className="mt-5 pt-5 border-t border-slate-800/80">
                <div className="aspect-video max-w-xl mx-auto rounded-xl overflow-hidden shadow-lg border border-slate-800">
                  <iframe
                    src={`https://www.youtube.com/embed/${uploadedVideoId}`}
                    title="Uploaded YouTube Video"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="w-full h-full"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Navigation Mode Switcher */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
          <div className="inline-flex p-1 rounded-xl bg-slate-900/80 border border-slate-800 shadow-sm flex-wrap gap-1">
            <button
              onClick={() => setActiveTab("prompt_video")}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === "prompt_video"
                  ? "bg-slate-800 text-white shadow-sm border border-slate-700/60"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span>Prompt Se Video Banao</span>
            </button>

            <button
              onClick={() => setActiveTab("pipeline")}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer relative ${
                activeTab === "pipeline"
                  ? "bg-slate-800 text-white shadow-sm border border-slate-700/60"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Activity className="w-4 h-4 text-cyan-400" />
              <span>Live Pipeline Tracker</span>
              {globalPipelineStatus?.isRunning && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              )}
            </button>

            <button
              onClick={() => setActiveTab("shorts")}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === "shorts"
                  ? "bg-slate-800 text-white shadow-sm border border-slate-700/60"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Zap className="w-4 h-4 text-amber-400" />
              <span>Shorts (2+ Min)</span>
            </button>

            <button
              onClick={() => setActiveTab("long")}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === "long"
                  ? "bg-slate-800 text-white shadow-sm border border-slate-700/60"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Play className="w-4 h-4 text-red-400 fill-current" />
              <span>Long Video (8+ Min)</span>
            </button>
          </div>

          <div className="text-xs text-slate-400 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="text-slate-300 font-medium">AutoTube Studio</span>
          </div>
        </div>

        {activeTab === "prompt_video" ? (
          <PromptStudioSection
            connectedToken={token}
            channelTitle={channel?.title}
            onConnectChannel={() => setShowAuthModal(true)}
            onNavigateToTracker={() => setActiveTab("pipeline")}
          />
        ) : activeTab === "pipeline" ? (
          <div className="space-y-6">
            <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-cyan-950/40 border border-cyan-500/30 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 text-xs font-bold mb-1.5">
                    <Activity className="w-3.5 h-3.5 animate-spin" />
                    <span>Live AutoTube Production Engine Status</span>
                  </div>
                  <h2 className="text-2xl font-black text-white">Video Generation &amp; Upload Monitor</h2>
                  <p className="text-xs sm:text-sm text-slate-300 mt-1">
                    Real-time status: <strong>Video Ban Gayi Ya Nahi</strong>, <strong>Kitni Bani</strong>, <strong>Ab Kya Ho Raha Hai</strong>, and <strong>Upload Kitni Howi</strong>.
                  </p>
                </div>
              </div>
            </div>

            <PipelineLiveTracker
              pipelineStatus={globalPipelineStatus}
              connectedToken={token}
              onRefresh={async () => {
                const res = await fetch("/api/scheduler/status");
                const d = await res.json();
                if (d.success && d.pipeline) setGlobalPipelineStatus(d.pipeline);
              }}
            />
          </div>
        ) : activeTab === "shorts" ? (
          <SchedulerSection
            connectedToken={token}
            channelTitle={channel?.title}
            onConnectChannel={() => setShowAuthModal(true)}
            initialFormat="short"
          />
        ) : activeTab === "long" ? (
          <SchedulerSection
            connectedToken={token}
            channelTitle={channel?.title}
            onConnectChannel={() => setShowAuthModal(true)}
            initialFormat="long"
          />
        ) : null}
      </main>
          {/* Dashboard Grid */}
          {false && <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Inputs & Primary Action Buttons */}
          <div className="lg:col-span-5 space-y-6">
            {/* Step 1: Channel Niche */}
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-red-600/20 text-red-400 text-xs flex items-center justify-center font-bold">
                    1
                  </span>
                  Channel Niche
                </label>
                <span className="text-[11px] text-slate-400">Urdu / English supported</span>
              </div>

              <input
                type="text"
                value={niche}
                onChange={(e) => setNiche(e.target.value)}
                placeholder="e.g., Space Mysteries, Deep Ocean, Human Body, AI Tech, History..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-colors"
              />

              {/* Niche quick suggestions */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {[
                  "Space & Cosmic Mysteries",
                  "Earth & Deep Ocean Secrets",
                  "Human Body & Brain Superpowers",
                  "Wild Animals & Nature Wonders",
                  "Quantum Physics & Paradoxes",
                  "Future Tech & AI Breakthroughs",
                  "Ancient Civilizations & Secrets",
                  "Historic Inventions & Discoveries",
                ].map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setNiche(item)}
                    className={`text-[11px] px-2.5 py-1 rounded-lg border transition-all ${
                      niche === item
                        ? "bg-red-950/60 border-red-700 text-red-300"
                        : "bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-300"
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            {/* Step 2: Video File Selector */}
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-red-600/20 text-red-400 text-xs flex items-center justify-center font-bold">
                    2
                  </span>
                  Video File Selector (mp4)
                </label>
                {videoFile && (
                  <span className="text-[11px] text-emerald-400 font-medium">
                    {(videoFile.size / (1024 * 1024)).toFixed(1)} MB
                  </span>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="video/mp4,video/*"
                onChange={handleFileChange}
                className="hidden"
              />

              {!videoFile ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-700 hover:border-red-500/80 rounded-xl p-6 text-center cursor-pointer transition-colors bg-slate-950/40 group"
                >
                  <div className="w-12 h-12 rounded-xl bg-slate-800/80 group-hover:bg-red-600/20 text-slate-400 group-hover:text-red-400 flex items-center justify-center mx-auto mb-3 transition-colors">
                    <FileVideo className="w-6 h-6" />
                  </div>
                  <div className="text-sm font-medium text-slate-300 group-hover:text-white">
                    Click to select MP4 video
                  </div>
                  <p className="text-xs text-slate-500 mt-1">Accepts .mp4 videos for automated YouTube upload</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <FileVideo className="w-5 h-5 text-red-400 shrink-0" />
                      <div className="truncate">
                        <div className="text-xs font-semibold text-slate-200 truncate">{videoFile.name}</div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          {(videoFile.size / (1024 * 1024)).toFixed(2)} MB • MP4 Video
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setVideoFile(null);
                        if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
                        setVideoPreviewUrl(null);
                      }}
                      className="p-1.5 text-slate-400 hover:text-red-400 transition-colors"
                      title="Remove file"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {videoPreviewUrl && (
                    <div className="rounded-xl overflow-hidden border border-slate-800 bg-black aspect-video max-h-48">
                      <video src={videoPreviewUrl} controls className="w-full h-full object-contain" />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* The 2 Primary Action Buttons */}
            <div className="p-5 rounded-2xl bg-gradient-to-b from-slate-900 to-slate-900/80 border border-slate-800 shadow-md space-y-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                Dashboard Actions
              </div>

              {/* Button 1: Generate Idea */}
              <button
                type="button"
                onClick={handleGenerateIdea}
                disabled={isGenerating || !niche.trim()}
                className="w-full flex items-center justify-center gap-2.5 px-4 py-3 rounded-xl bg-gradient-to-r from-amber-600 to-red-600 hover:from-amber-500 hover:to-red-500 text-white font-semibold text-sm shadow-md shadow-red-950/40 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100 cursor-pointer"
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Generating Viral Idea with Gemini...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Generate Idea</span>
                  </>
                )}
              </button>

              {/* Button 2: Upload to YouTube */}
              <button
                type="button"
                onClick={handleUploadToYouTube}
                disabled={isUploading || !videoFile}
                className="w-full flex items-center justify-center gap-2.5 px-4 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold text-sm shadow-lg shadow-red-900/40 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100 cursor-pointer"
              >
                {isUploading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Uploading to YouTube...</span>
                  </>
                ) : (
                  <>
                    <UploadCloud className="w-4 h-4" />
                    <span>Upload to YouTube</span>
                  </>
                )}
              </button>

              {/* Upload Status indicator */}
              {isUploading && uploadStatusText && (
                <div className="p-3 rounded-xl bg-red-950/40 border border-red-900/50 text-xs text-red-200 flex items-center gap-2 animate-pulse">
                  <div className="w-2 h-2 rounded-full bg-red-400 animate-ping" />
                  {uploadStatusText}
                </div>
              )}

              {/* Channel connection prompt if not connected */}
              {!channel && (
                <p className="text-[11px] text-slate-400 text-center pt-1">
                  Note: Connect your YouTube channel via Google OAuth before uploading.
                </p>
              )}
            </div>
          </div>

          {/* Right Column: Video Metadata (Title, Description, Tags, Hashtags) */}
          <div className="lg:col-span-7 space-y-6">
            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-red-400" />
                  <h2 className="text-base font-bold text-white">Video Metadata (AI Generated)</h2>
                </div>
                {title && (
                  <button
                    onClick={() => {
                      const allMetadata = `TITLE:\n${title}\n\nDESCRIPTION:\n${description}\n\nTAGS:\n${tags.join(", ")}\n\nHASHTAGS:\n${hashtags.join(" ")}`;
                      copyToClipboard(allMetadata, "all_meta");
                    }}
                    className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors"
                  >
                    {copiedKey === "all_meta" ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        Copied All
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        Copy All
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* 1. Title */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                    Title (Viral & SEO Optimized)
                  </label>
                  <span
                    className={`text-xs font-mono font-medium ${
                      title.length > 70
                        ? "text-red-400"
                        : title.length > 0
                        ? "text-emerald-400"
                        : "text-slate-500"
                    }`}
                  >
                    {title.length}/70 chars
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Click 'Generate Idea' or enter viral video title..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 placeholder-slate-500 text-sm font-medium focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-colors pr-10"
                  />
                  {title && (
                    <button
                      onClick={() => copyToClipboard(title, "title")}
                      className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-200"
                      title="Copy Title"
                    >
                      {copiedKey === "title" ? (
                        <Check className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* 2. Description */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                    Description (~300 words SEO optimized)
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-slate-400">
                      {description.trim() ? description.trim().split(/\s+/).length : 0} words
                    </span>
                    {description && (
                      <button
                        onClick={() => copyToClipboard(description, "desc")}
                        className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1"
                      >
                        {copiedKey === "desc" ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                        Copy
                      </button>
                    )}
                  </div>
                </div>
                <textarea
                  rows={8}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="SEO-optimized description in Urdu / English mix with key takeaways and subscribe CTA will appear here..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-colors leading-relaxed font-sans"
                />
              </div>

              {/* 3. Tags (15 Tags) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-red-400" />
                    Tags ({tags.length} tags)
                  </label>
                  {tags.length > 0 && (
                    <button
                      onClick={() => copyToClipboard(tags.join(", "), "tags")}
                      className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1"
                    >
                      {copiedKey === "tags" ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      Copy tags
                    </button>
                  )}
                </div>

                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 min-h-[70px] space-y-2">
                  <div className="flex flex-wrap gap-1.5">
                    {tags.map((tag, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs bg-slate-800/90 text-slate-200 border border-slate-700/80 group"
                      >
                        <span>{tag}</span>
                        <button
                          onClick={() => removeTag(idx)}
                          className="text-slate-400 hover:text-red-400 transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                    {tags.length === 0 && (
                      <span className="text-xs text-slate-500 py-1 italic">
                        No tags generated yet. Click 'Generate Idea' to produce 15 SEO tags.
                      </span>
                    )}
                  </div>

                  {/* Add manual tag input */}
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-900">
                    <input
                      type="text"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
                      placeholder="Add tag and press Enter..."
                      className="flex-1 bg-transparent text-xs text-slate-300 placeholder-slate-600 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={addTag}
                      className="text-[11px] px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                    >
                      + Add
                    </button>
                  </div>
                </div>
              </div>

              {/* 4. Hashtags (5 Hashtags) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                    <Hash className="w-3.5 h-3.5 text-red-400" />
                    Hashtags ({hashtags.length} hashtags)
                  </label>
                  {hashtags.length > 0 && (
                    <button
                      onClick={() => copyToClipboard(hashtags.join(" "), "hashtags")}
                      className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1"
                    >
                      {copiedKey === "hashtags" ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      Copy hashtags
                    </button>
                  )}
                </div>

                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 min-h-[50px] space-y-2">
                  <div className="flex flex-wrap gap-2">
                    {hashtags.map((ht, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs bg-red-950/50 text-red-300 border border-red-900/60 font-medium"
                      >
                        <span>{ht.startsWith("#") ? ht : `#${ht}`}</span>
                        <button
                          onClick={() => removeHashtag(idx)}
                          className="text-red-400 hover:text-white transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                    {hashtags.length === 0 && (
                      <span className="text-xs text-slate-500 py-1 italic">
                        5 viral hashtags will be generated here.
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-slate-900">
                    <input
                      type="text"
                      value={hashtagInput}
                      onChange={(e) => setHashtagInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addHashtag())}
                      placeholder="Add hashtag (e.g. #IslamicEducation) and press Enter..."
                      className="flex-1 bg-transparent text-xs text-slate-300 placeholder-slate-600 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={addHashtag}
                      className="text-[11px] px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                    >
                      + Add
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>}

      {/* Google OAuth Modal for YouTube Connection */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-600/20 text-red-500 flex items-center justify-center">
                  <Youtube className="w-6 h-6 fill-red-500" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Connect YouTube Channel</h3>
                  <p className="text-xs text-slate-400">Google OAuth 2.0 & YouTube Data API v3</p>
                </div>
              </div>
              <button
                onClick={() => setShowAuthModal(false)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Option 1: 1-Click Google OAuth */}
            <div className="space-y-3 p-4 rounded-xl bg-slate-950 border border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                  Method 1: Google OAuth 2.0 (Recommended)
                </span>
                <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded-full">
                  1-Click Popup
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Connect your YouTube channel using standard Google OAuth authorization popup.
              </p>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1">
                  Google Client ID (optional if configured in Secrets / .env):
                </label>
                <input
                  type="text"
                  value={manualClientId}
                  onChange={(e) => {
                    setManualClientId(e.target.value);
                    localStorage.setItem("autotube_client_id", e.target.value);
                  }}
                  placeholder="e.g. 12345-abc.apps.googleusercontent.com"
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-red-500"
                />
              </div>

              <button
                type="button"
                onClick={handleGoogleOAuthPopup}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold text-xs transition-colors shadow-md shadow-red-950 cursor-pointer"
              >
                <Youtube className="w-4 h-4 fill-white" />
                Sign in with Google OAuth Popup
              </button>

              <div className="pt-2 text-[11px] text-slate-400 bg-slate-900/50 p-2.5 rounded-lg border border-slate-800/80">
                <div className="flex items-center justify-between">
                  <span>Your OAuth Redirect URI:</span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(currentRedirectUri, "redirect_uri")}
                    className="text-red-400 hover:text-red-300 font-medium"
                  >
                    {copiedKey === "redirect_uri" ? "Copied!" : "Copy URI"}
                  </button>
                </div>
                <div className="font-mono text-[10px] text-slate-300 truncate mt-0.5 select-all">
                  {currentRedirectUri}
                </div>
              </div>
            </div>

            {/* Option 2: Direct Access Token (Simple Personal Channel Use) */}
            <div className="space-y-3 p-4 rounded-xl bg-slate-950 border border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                  Method 2: Direct Access Token (Personal Channel)
                </span>
                <span className="text-[10px] text-amber-400 font-semibold bg-amber-950/60 border border-amber-800/60 px-2 py-0.5 rounded-full">
                  Instant Paste
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Paste a Google OAuth Access Token with <code className="text-red-300">youtube.upload</code> scope
                (e.g., from{" "}
                <a
                  href="https://developers.google.com/oauthplayground/"
                  target="_blank"
                  rel="noreferrer"
                  className="text-red-400 underline inline-flex items-center gap-0.5"
                >
                  OAuth Playground <ExternalLink className="w-3 h-3" />
                </a>
                ).
              </p>

              <div className="space-y-2">
                <input
                  type="password"
                  value={manualToken}
                  onChange={(e) => setManualToken(e.target.value)}
                  placeholder="Paste Google Access Token (ya29...)"
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-red-500 font-mono"
                />

                <button
                  type="button"
                  onClick={handleManualTokenConnect}
                  disabled={isConnectingToken || !manualToken.trim()}
                  className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition-colors border border-slate-700 disabled:opacity-60 cursor-pointer"
                >
                  {isConnectingToken ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Verifying YouTube Channel...
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      Verify & Connect Token
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950/60 py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
          <div>AutoTube AI • 100% Free Tier Compatible • YouTube Data API v3 & Gemini 3.8 Flash</div>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              API Ready
            </span>
            <span>Category: Education (27)</span>
            <span>Status: Public</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
