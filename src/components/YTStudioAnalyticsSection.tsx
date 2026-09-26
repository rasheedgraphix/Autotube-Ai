import React, { useState, useEffect } from "react";
import {
  BarChart3,
  TrendingUp,
  Users,
  Eye,
  Clock,
  Globe2,
  Tv,
  Smartphone,
  Monitor,
  ExternalLink,
  RefreshCw,
  Sparkles,
  ArrowUpRight,
  ShieldCheck,
  Zap,
  Play,
  CheckCircle2,
  AlertCircle,
  Key,
  ThumbsUp,
  MessageSquare,
  Lock,
  Layers,
  Award,
} from "lucide-react";
import { safeFetchJson } from "../utils/safeFetch";

interface YTStudioAnalyticsSectionProps {
  connectedToken: string | null;
  channelTitle?: string;
  onConnectChannel: () => void;
}

export default function YTStudioAnalyticsSection({
  connectedToken,
  channelTitle,
  onConnectChannel,
}: YTStudioAnalyticsSectionProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filterFormat, setFilterFormat] = useState<"all" | "shorts" | "long">("all");
  const [manualTokenInput, setManualTokenInput] = useState("");
  const [connectingManual, setConnectingManual] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const fetchAnalytics = async () => {
    setIsRefreshing(true);
    setAuthError(null);
    try {
      const { ok, data: resData } = await safeFetchJson<any>("/api/studio/analytics", {
        headers: connectedToken ? { Authorization: `Bearer ${connectedToken}` } : {},
      });
      if (ok && resData?.success && resData?.data) {
        setData(resData.data);
      }
    } catch (err: any) {
      console.error("Failed to load studio analytics:", err);
      setAuthError(err.message || "Failed to connect to YouTube Studio API");
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [connectedToken]);

  const handleQuickConnectToken = async () => {
    if (!manualTokenInput.trim()) {
      setAuthError("Please paste a valid Google OAuth Access Token.");
      return;
    }
    setConnectingManual(true);
    setAuthError(null);
    try {
      const { ok, data: resJson, error } = await safeFetchJson<any>("/api/auth/connect-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: manualTokenInput.trim() }),
      });
      if (!ok || !resJson?.success) {
        throw new Error(error || resJson?.error || "Invalid Google Access Token.");
      }
      localStorage.setItem("autotube_token", resJson.token);
      setManualTokenInput("");
      await fetchAnalytics();
    } catch (err: any) {
      setAuthError(err.message || "Failed to connect YouTube channel.");
    } finally {
      setConnectingManual(false);
    }
  };

  if (loading) {
    return (
      <div className="p-12 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col items-center justify-center text-center space-y-3">
        <RefreshCw className="w-8 h-8 text-red-500 animate-spin" />
        <h3 className="text-base font-bold text-white">Connecting to YouTube Data API v3...</h3>
        <p className="text-xs text-slate-400">Querying real-time channel subscribers, lifetime views, and uploaded video metrics.</p>
      </div>
    );
  }

  // If YouTube Channel is NOT connected
  if (!data?.connected || !data?.channel) {
    return (
      <div className="space-y-6">
        <div className="p-8 rounded-2xl bg-gradient-to-r from-red-950/40 via-slate-900 to-slate-900 border border-red-500/40 shadow-2xl relative overflow-hidden">
          <div className="max-w-2xl space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-600/20 border border-red-500/40 text-red-300 text-xs font-bold">
              <AlertCircle className="w-3.5 h-3.5 text-red-400" />
              <span>Real-Time YouTube Sync Required</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white">
              Connect Your Real YouTube Channel
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              To display <strong>100% authentic, real-time subscribers</strong>, <strong>views</strong>, <strong>likes</strong>, and <strong>uploaded video statistics</strong> directly from YouTube (and no fake/estimated numbers), please connect your YouTube account.
            </p>

            {data?.message && (
              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-amber-500/30 text-xs text-amber-200 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>{data.message}</span>
              </div>
            )}

            {authError && (
              <div className="p-3.5 rounded-xl bg-red-950/80 border border-red-500/40 text-xs text-red-200 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            {/* In-place Token Connect Box */}
            <div className="pt-2 space-y-3">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Quick Connect (Google Access Token):
              </div>
              <div className="flex flex-col sm:flex-row items-center gap-2.5">
                <input
                  type="password"
                  value={manualTokenInput}
                  onChange={(e) => setManualTokenInput(e.target.value)}
                  placeholder="Paste Google OAuth Access Token (ya_29...)"
                  className="w-full sm:flex-1 px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-mono focus:border-red-500 focus:outline-none placeholder:text-slate-600"
                />
                <button
                  onClick={handleQuickConnectToken}
                  disabled={connectingManual || !manualTokenInput.trim()}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-xs font-bold transition-all cursor-pointer inline-flex items-center justify-center gap-2 shrink-0 shadow-lg shadow-red-950"
                >
                  {connectingManual ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Key className="w-3.5 h-3.5" />}
                  <span>Connect &amp; Sync Real Data</span>
                </button>
              </div>

              <div className="flex items-center gap-3 pt-1">
                <span className="text-xs text-slate-500">or</span>
                <button
                  onClick={onConnectChannel}
                  className="text-xs font-bold text-red-400 hover:text-red-300 underline underline-offset-4 cursor-pointer"
                >
                  Connect with Google 1-Click OAuth Modal &rarr;
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const channel = data.channel;
  const overview = data.overview || {};
  const performance = data.performanceSummary || {};
  const allVideos: any[] = data.recentVideos || [];

  const filteredVideos = allVideos.filter((vid) => {
    if (filterFormat === "shorts") return vid.format === "9:16 Short";
    if (filterFormat === "long") return vid.format === "16:9 Long Video";
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Verified YouTube Studio Master Header */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-red-950/40 via-slate-900 to-slate-900 border border-red-500/30 shadow-2xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 relative z-10">
          <div className="flex items-center gap-4">
            {channel.thumbnail ? (
              <img
                src={channel.thumbnail}
                alt={channel.title}
                className="w-16 h-16 rounded-2xl border-2 border-red-500/40 object-cover shadow-lg"
              />
            ) : (
              <div className="w-16 h-16 rounded-2xl border-2 border-red-500/40 bg-red-600/20 flex items-center justify-center text-red-400 text-xl font-black">
                {channel.title?.charAt(0) || "YT"}
              </div>
            )}
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-full bg-red-600 text-white text-[10px] font-black uppercase tracking-wider">
                  YT Studio Live Sync
                </span>
                <span className="text-xs text-slate-400 font-mono">{channel.customUrl}</span>
                {channel.channelUrl && (
                  <a
                    href={channel.channelUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-red-400 hover:text-red-300 font-bold inline-flex items-center gap-1 ml-1"
                  >
                    <span>View on YouTube</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
                <span>{channel.title}</span>
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
              </h2>
              <div className="flex items-center gap-3 text-xs text-slate-300 flex-wrap">
                <span className="font-bold text-white">{channel.subscriberCount}</span> subscribers
                <span className="text-slate-600">•</span>
                <span className="font-bold text-white">{channel.viewCount}</span> total views
                <span className="text-slate-600">•</span>
                <span className="font-bold text-white">{channel.videoCount}</span> uploaded videos
                {overview.channelCreatedDate && (
                  <>
                    <span className="text-slate-600">•</span>
                    <span className="text-slate-400">Created: {overview.channelCreatedDate}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={fetchAnalytics}
              disabled={isRefreshing}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-all cursor-pointer shadow-lg shadow-red-950"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
              <span>{isRefreshing ? "Fetching YouTube Data..." : "Sync Live YouTube Data"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Verified Real Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Real Total Views */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-2 hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Channel Views</span>
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Eye className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-white">{overview.views || "0"}</div>
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <span className="font-semibold text-emerald-400">Verified</span>
            <span>official YouTube lifetime views</span>
          </div>
        </div>

        {/* Card 2: Real Subscribers */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-2 hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Subscribers</span>
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-white">{overview.subscribers || "0"}</div>
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <span className="font-semibold text-purple-400">Live Count</span>
            <span>from YouTube Data API v3</span>
          </div>
        </div>

        {/* Card 3: Real Uploaded Videos */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-2 hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Uploaded Videos</span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-white">{overview.videoCount || "0"}</div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="text-amber-400 font-bold">{performance.shortsCount || 0} Shorts</span>
            <span>•</span>
            <span className="text-slate-300 font-bold">{performance.longCount || 0} Long Videos</span>
          </div>
        </div>

        {/* Card 4: Real Total Video Likes */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-2 hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Video Likes</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <ThumbsUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-white">{overview.totalLikes || "0"}</div>
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <span className="text-emerald-400 font-bold">{overview.totalComments || "0"} comments</span>
            <span>across uploaded videos</span>
          </div>
        </div>
      </div>

      {/* Secondary Performance Bar (Avg Views, Watch Hours, Engagement Rate) */}
      <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-6 flex-wrap">
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Avg Views Per Video</div>
            <div className="text-lg font-black text-white">{overview.avgViewsPerVideo || "0"}</div>
          </div>
          <div className="hidden sm:block w-px h-8 bg-slate-800" />
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Estimated Watch Time</div>
            <div className="text-lg font-black text-amber-400">{overview.watchTimeHours || "0"} Hours</div>
          </div>
          <div className="hidden sm:block w-px h-8 bg-slate-800" />
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Channel Engagement</div>
            <div className="text-lg font-black text-emerald-400">{overview.engagementRate || "0.0%"}</div>
          </div>
        </div>

        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-400">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>{overview.verifiedDataSource || "YouTube Data API v3 Live Sync"}</span>
        </div>
      </div>

      {/* Top Performing Video Feature (if available) */}
      {performance.topPerformingVideo && (
        <div className="p-5 rounded-2xl bg-gradient-to-r from-amber-950/30 via-slate-900 to-slate-900 border border-amber-500/30 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="relative shrink-0">
              <img
                src={performance.topPerformingVideo.thumbnail}
                alt={performance.topPerformingVideo.title}
                className="w-24 h-14 rounded-xl object-cover border border-amber-500/40"
              />
              <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/80 text-[10px] font-mono text-white">
                {performance.topPerformingVideo.duration}
              </span>
            </div>
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold">
                <Award className="w-3 h-3 text-amber-400" />
                <span>#1 Most Viewed Video on Channel</span>
              </div>
              <h4 className="text-sm font-bold text-white line-clamp-1">
                {performance.topPerformingVideo.title}
              </h4>
              <div className="text-xs text-slate-400 flex items-center gap-3">
                <span className="font-bold text-white">{performance.topPerformingVideo.views} views</span>
                <span>•</span>
                <span>{performance.topPerformingVideo.likes} likes</span>
                <span>•</span>
                <span>{performance.topPerformingVideo.format}</span>
              </div>
            </div>
          </div>

          {performance.topPerformingVideo.youtubeUrl && (
            <a
              href={performance.topPerformingVideo.youtubeUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-all cursor-pointer shrink-0"
            >
              <span>Watch Top Video</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      )}

      {/* Real Uploaded Videos Table */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div>
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <Play className="w-4 h-4 text-red-500 fill-red-500" />
              <span>Real Uploaded Channel Content ({filteredVideos.length})</span>
            </h3>
            <p className="text-xs text-slate-400">
              Live statistics fetched directly from your connected YouTube account.
            </p>
          </div>

          <div className="inline-flex rounded-xl bg-slate-950 p-1 border border-slate-800">
            <button
              onClick={() => setFilterFormat("all")}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                filterFormat === "all" ? "bg-red-600 text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              All ({allVideos.length})
            </button>
            <button
              onClick={() => setFilterFormat("shorts")}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                filterFormat === "shorts" ? "bg-red-600 text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              Shorts ({performance.shortsCount || 0})
            </button>
            <button
              onClick={() => setFilterFormat("long")}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                filterFormat === "long" ? "bg-red-600 text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              Long Videos ({performance.longCount || 0})
            </button>
          </div>
        </div>

        {filteredVideos.length === 0 ? (
          <div className="text-center py-10 space-y-2">
            <Layers className="w-8 h-8 text-slate-600 mx-auto" />
            <p className="text-xs font-semibold text-slate-300">
              {allVideos.length === 0
                ? "Your connected channel currently has 0 uploaded videos."
                : "No videos match the selected filter."}
            </p>
            <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
              Generate and upload your first cricket documentary or Short using the Cricket Studio or Scheduler!
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="p-3">Video Title &amp; Duration</th>
                  <th className="p-3">Format</th>
                  <th className="p-3">Visibility</th>
                  <th className="p-3 font-mono">Views</th>
                  <th className="p-3 font-mono">Likes</th>
                  <th className="p-3 font-mono">Comments</th>
                  <th className="p-3">Engagement</th>
                  <th className="p-3 text-right">Watch</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredVideos.map((vid: any, idx: number) => (
                  <tr key={idx} className="hover:bg-slate-800/40 transition-all">
                    <td className="p-3 max-w-xs sm:max-w-md">
                      <div className="flex items-center gap-3">
                        <div className="relative shrink-0">
                          {vid.thumbnail ? (
                            <img
                              src={vid.thumbnail}
                              alt={vid.title}
                              className="w-16 h-10 rounded-lg object-cover border border-slate-700"
                            />
                          ) : (
                            <div className="w-16 h-10 rounded-lg bg-red-600/20 flex items-center justify-center">
                              <Play className="w-4 h-4 text-red-400" />
                            </div>
                          )}
                          <span className="absolute bottom-0.5 right-0.5 px-1 rounded bg-black/80 text-[9px] font-mono text-white">
                            {vid.duration}
                          </span>
                        </div>
                        <div className="space-y-0.5 min-w-0">
                          <p className="font-bold text-white truncate text-xs">{vid.title}</p>
                          <p className="text-[10px] text-slate-400">
                            {vid.publishedAt
                              ? new Date(vid.publishedAt).toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                })
                              : "Uploaded"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          vid.format === "9:16 Short"
                            ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                            : "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                        }`}
                      >
                        {vid.format}
                      </span>
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          vid.visibility?.toLowerCase() === "public"
                            ? "bg-emerald-500/20 text-emerald-300"
                            : vid.visibility?.toLowerCase() === "unlisted"
                            ? "bg-amber-500/20 text-amber-300"
                            : "bg-slate-700 text-slate-300"
                        }`}
                      >
                        {vid.visibility}
                      </span>
                    </td>
                    <td className="p-3 font-mono font-bold text-white">{vid.views}</td>
                    <td className="p-3 font-mono text-slate-300">{vid.likes}</td>
                    <td className="p-3 font-mono text-slate-300">{vid.comments}</td>
                    <td className="p-3 font-mono text-emerald-400 font-bold">{vid.engagementRate}</td>
                    <td className="p-3 text-right">
                      {vid.youtubeUrl && vid.youtubeUrl !== "#" ? (
                        <a
                          href={vid.youtubeUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-red-400 hover:text-red-300 font-bold inline-flex items-center gap-1"
                        >
                          <span>Watch</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <span className="text-slate-500">Local Only</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
