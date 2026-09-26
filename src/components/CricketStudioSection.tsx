import React, { useState, useEffect } from "react";
import {
  Sparkles,
  Play,
  RefreshCw,
  Zap,
  CheckCircle2,
  AlertCircle,
  Clock,
  ExternalLink,
  Sliders,
  Flame,
  Trophy,
  Activity,
  Send,
  Volume2,
  Check,
  Film,
  Search,
  Calendar,
  Link as LinkIcon,
  Video,
  Layers,
  Scissors,
  FileVideo,
  Upload,
  Download,
} from "lucide-react";
import PipelineLiveTracker from "./PipelineLiveTracker";

export interface CricketMatchItem {
  id: string;
  matchTitle: string;
  tournament: string;
  teams: {
    team1: string;
    team2: string;
  };
  resultSummary: string;
  topBatters: string;
  topBowlers: string;
  turningPoint: string;
  viralHook: string;
  demandScore: number;
  trendingBadge: "🔥 Most Watched" | "⚡ Last-Over Thriller" | "🏆 Series Decider" | "🏏 Record Breaking";
  matchDateBadge?: "🔴 Aaj Ka Match (Today)" | "⚡ Kal Ka Match (Yesterday)" | "🏏 2 Din Pehle (2 Days Ago)";
  matchDateText?: string;
  searchVolume: string;
  summary: string;
  keyChapters: string[];
}

export interface CuratedVoice {
  id: string;
  name: string;
  lang: "urdu" | "hindi" | "both" | "english";
  tag: string;
  badge: string;
  description: string;
  stability: number;
  gender: "male" | "female";
  isTopPick?: boolean;
}

export const ELEVENLABS_CURATED_VOICES: CuratedVoice[] = [
  {
    id: "aPfeouerZvEVukwmLSP0",
    name: "Haseeb",
    lang: "urdu",
    badge: "Urdu #1 Pick (Male)",
    tag: "High-Energy Sports Presenter",
    description: "Deep, authentic, broadcast-grade Urdu voice. Tuned at 55% stability for maximum natural cadence in cricket commentary and highlight breakdowns.",
    stability: 0.55,
    gender: "male",
    isTopPick: true,
  },
  {
    id: "Y6nOpHQlW4lnf9GRRc8f",
    name: "Adarsh",
    lang: "both",
    badge: "Hindi #1 Pick & Cricket Channels",
    tag: "Deep, Authoritative & Emotional",
    description: "The premier voice used by top Hindi & Pakistani sports channels. Exceptional depth and emotional punch for thrilling match moments.",
    stability: 0.50,
    gender: "male",
    isTopPick: true,
  },
  {
    id: "Qxb5zQvEo3DYQK2HNnXm",
    name: "Kunal Agarwal",
    lang: "hindi",
    badge: "Confident Mature Indian Male",
    tag: "Match Highlights & Audio",
    description: "Deep, confident, mature baritone. Explicitly tagged for sports highlights and high-engagement videos.",
    stability: 0.50,
    gender: "male",
  },
  {
    id: "WiaIVvI1gDL4vT4y7qUU",
    name: "Suman Pro",
    lang: "urdu",
    badge: "Deep & Calm Urdu Narrator",
    tag: "Gentle Late 20s/30s Tone",
    description: "Gentle, calm and articulate tone that renders Urdu scripts with poise and crystal-clear pronunciation.",
    stability: 0.50,
    gender: "male",
  },
  {
    id: "VESUG427mhGhpQ6fo6Rh",
    name: "Ravikant",
    lang: "both",
    badge: "Warm Native Sports Style",
    tag: "Pure Native Warm Clarity",
    description: "Warm, authentic Indian native voice. Perfect for match highlights and sports breakdowns.",
    stability: 0.50,
    gender: "male",
  },
  {
    id: "qDuRKMlYmrm8trt5QyBn",
    name: "Taksh",
    lang: "hindi",
    badge: "Powerful & Commanding",
    tag: "High Stakes & Climax Finish",
    description: "Commanding, thunderous delivery ideal for high-stakes matches, final-over finishes and historic rivalries.",
    stability: 0.50,
    gender: "male",
  },
  {
    id: "gHu9GtaHOXcSqFTK06ux",
    name: "Anjali",
    lang: "hindi",
    badge: "Soothing Hindi Female",
    tag: "Calming & Engaging",
    description: "Soothing, articulate and highly engaging female Hindi narration, ideal for sports highlights storytelling.",
    stability: 0.50,
    gender: "female",
  },
  {
    id: "1qEiC6qsybMkmnNdVMbK",
    name: "Monika Sogam",
    lang: "hindi",
    badge: "Hindi Modulated Female",
    tag: "Expressive Modulations",
    description: "One of the most praised female Hindi voices with wide expressive range and natural inflections.",
    stability: 0.50,
    gender: "female",
  },
  {
    id: "pNInz6obpgDQGcFmaJgB",
    name: "Adam (Multilingual v2)",
    lang: "both",
    badge: "Cinematic Deep Voice",
    tag: "Multilingual v2 Deep Narrative",
    description: "The classic deep cinematic sports voice with automatic native Urdu/Hindi synthesis.",
    stability: 0.50,
    gender: "male",
  },
  {
    id: "ppLqTilh7rH7fbUVlXsf",
    name: "David",
    lang: "english",
    badge: "Sports Commentary Voice",
    tag: "Gritty International Voice",
    description: "Deep, gritty British commentator for international English broadcast highlights.",
    stability: 0.50,
    gender: "male",
  },
];

interface CricketStudioSectionProps {
  connectedToken: string | null;
  channelTitle?: string;
  onConnectChannel: () => void;
}

export default function CricketStudioSection({
  connectedToken,
  channelTitle,
  onConnectChannel,
}: CricketStudioSectionProps) {
  const [matches, setMatches] = useState<CricketMatchItem[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<CricketMatchItem | null>(null);
  const [activeMode, setActiveMode] = useState<"highlights" | "matches" | "custom">("highlights");
  const [highlightUrl1, setHighlightUrl1] = useState("");
  const [highlightUrl2, setHighlightUrl2] = useState("");
  const [highlightUrl3, setHighlightUrl3] = useState("");
  const [isInspecting, setIsInspecting] = useState(false);
  const [inspectedItems, setInspectedItems] = useState<any[]>([]);
  const [inspectError, setInspectError] = useState<string | null>(null);

  const [isCustom, setIsCustom] = useState(false);
  const [customTitle, setCustomTitle] = useState("");
  const [customSummary, setCustomSummary] = useState("");
  const [videoFormat, setVideoFormat] = useState<"long" | "short">("short");
  const [languageStyle, setLanguageStyle] = useState<"urdu" | "hindi" | "urdu_hindi" | "english">("urdu");
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>("auto");
  const [privacyStatus, setPrivacyStatus] = useState<"public" | "unlisted" | "private">("public");
  const [searchQuery, setSearchQuery] = useState("");

  // Highlight Moments Filtering & Anti-Copyright Engine Options
  const [filterMode, setFilterMode] = useState<
    "all_sixes_fours" | "all_wickets" | "specific_bowler" | "specific_batsman" | "full_match_highlights"
  >("all_sixes_fours");
  const [targetPlayerName, setTargetPlayerName] = useState("Shaheen Shah Afridi");
  const [bgmStyle, setBgmStyle] = useState<
    "high_energy_phonk" | "stadium_beats" | "cinematic_trap" | "epic_nasheed"
  >("high_energy_phonk");
  const [copyrightShield, setCopyrightShield] = useState(true);

  const [isLoadingMatches, setIsLoadingMatches] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [pipelineStatus, setPipelineStatus] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleInspectHighlights = async () => {
    const urls = [highlightUrl1, highlightUrl2, highlightUrl3].map((u) => u.trim()).filter(Boolean);
    if (urls.length === 0) {
      setInspectError("Barahe karam kam az kam 1 highlight link (YouTube URL) dalein.");
      return;
    }
    setInspectError(null);
    setIsInspecting(true);
    try {
      const res = await fetch("/api/cricket/inspect-highlights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Links inspect karne me masla pesh aya.");
      }
      setInspectedItems(data.highlights || []);
      if (data.highlights && data.highlights[0] && !customTitle) {
        setCustomTitle(data.highlights[0].title);
      }
    } catch (err: any) {
      setInspectError(err.message || "Failed to inspect highlight links.");
    } finally {
      setIsInspecting(false);
    }
  };

  // Check pipeline status on mount and poll
  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  const fetchMatches = async (query?: string) => {
    setIsLoadingMatches(true);
    setErrorMsg(null);
    try {
      const url = query ? `/api/cricket/matches?q=${encodeURIComponent(query)}` : "/api/cricket/matches";
      const res = await fetch(url);
      const data = await res.json();
      if (data.success && Array.isArray(data.matches)) {
        setMatches(data.matches);
        if (data.matches.length > 0 && !selectedMatch) {
          setSelectedMatch(data.matches[0]);
        }
      }
    } catch (err: any) {
      console.error("Failed to load cricket matches:", err);
    } finally {
      setIsLoadingMatches(false);
    }
  };

  const checkStatus = async () => {
    try {
      const res = await fetch("/api/scheduler/status");
      const data = await res.json();
      if (data.success && data.pipeline) {
        setPipelineStatus(data.pipeline);
        setIsGenerating(data.pipeline.isRunning);
      }
    } catch {
      // Ignore polling errors
    }
  };

  const handleGenerate = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);

    let matchToUse: any = null;
    let highlightUrlsToUse: string[] = [];

    const urls = [highlightUrl1, highlightUrl2, highlightUrl3]
      .map((u) => u.trim())
      .filter((u) => u && (u.includes("http://") || u.includes("https://")));

    if (urls.length === 0) {
      setErrorMsg("Barahe karam kam az kam 1 valid match highlight link (YouTube URL) dalein!");
      return;
    }
    highlightUrlsToUse = urls;
    const detectedTitle =
      customTitle.trim() ||
      inspectedItems[0]?.title ||
      `Cricket Match Highlights & Key Moments (${urls.length} Source${urls.length > 1 ? "s" : ""})`;

    matchToUse = {
      id: `highlight-${Date.now()}`,
      matchTitle: detectedTitle,
      tournament: "Cricket Highlights Breakdown",
      teams: { team1: "Match", team2: "Action" },
      resultSummary:
        customSummary.trim() ||
        `5-second action breakdown of pivotal moments from ${urls.length} highlight video(s).`,
      topBatters: "Star match performers",
      topBowlers: "Key wickets and turning overs",
      turningPoint: "High-octane match moments captured in 5-second video clips",
      viralHook: detectedTitle,
      demandScore: 99,
      trendingBadge: "⚡ Last-Over Thriller",
      searchVolume: "Very High",
      summary: customSummary.trim() || detectedTitle,
      highlightUrls: urls,
    };

    setIsGenerating(true);

    try {
      const res = await fetch("/api/cricket/generate-documentary", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(connectedToken ? { Authorization: `Bearer ${connectedToken}` } : {}),
        },
        body: JSON.stringify({
          match: matchToUse,
          highlightUrls: highlightUrlsToUse.length > 0 ? highlightUrlsToUse : undefined,
          videoFormat,
          languageStyle,
          voiceId: selectedVoiceId === "auto" ? undefined : selectedVoiceId,
          privacyStatus,
          oauthToken: connectedToken,
          filterMode,
          targetPlayerName:
            filterMode === "specific_bowler" || filterMode === "specific_batsman"
              ? targetPlayerName.trim()
              : undefined,
          bgmStyle,
          copyrightShield,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to start cricket video generation.");
      }

      setSuccessMsg(data.message || "Cricket video editing pipeline started successfully!");
      checkStatus();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to start generation.");
      setIsGenerating(false);
    }
  };

  const isRunning = pipelineStatus?.isRunning;
  const currentStep = pipelineStatus?.currentStep;
  const activeLogs = pipelineStatus?.activeLogs || [];
  const lastRun = pipelineStatus?.lastRun;

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-emerald-950/50 via-slate-900 to-amber-950/40 border border-emerald-500/30 shadow-xl relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold">
              <Trophy className="w-3.5 h-3.5 text-amber-400" />
              <span>Cricket Video Editor & Highlights Studio</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Cricket Video Editing &amp; Highlights Studio 🏏
            </h2>
            <p className="text-slate-300 text-xs sm:text-sm max-w-3xl leading-relaxed">
              Edit cricket match videos &amp; highlights (e.g.{" "}
              <strong className="text-white">Pakistan vs Australia</strong>,{" "}
              <strong className="text-white">India vs England</strong>, PSL, IPL, World Cup thrillers).
              The AI automatically cuts 5-second action clips, adds thrilling{" "}
              <strong className="text-emerald-300">Urdu / Hindi commentary</strong>, applies Anti-Copyright Shielding, and creates a{" "}
              <strong className="text-emerald-300">9:16 Shorts Edit</strong> or <strong className="text-emerald-300">16:9 Landscape Video</strong> ready for you to preview and upload to YouTube.
            </p>
          </div>

        </div>
      </div>

      {/* Notifications */}
      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-950/50 border border-red-800/60 flex items-start gap-3 text-red-200">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div className="text-sm">{errorMsg}</div>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-950/50 border border-emerald-800/60 flex items-start gap-3 text-emerald-200">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <div className="text-sm">{successMsg}</div>
        </div>
      )}

      {/* Live Pipeline & Video Status Tracker (Answers: Video Ban Gayi? Kitni Bani? Ab Kya Ho Raha Hai? Upload Kitni Howi?) */}
      <PipelineLiveTracker 
        pipelineStatus={pipelineStatus} 
        onRefresh={checkStatus} 
        connectedToken={connectedToken} 
      />

      {/* Main Grid: Highlight Links & Configuration */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Highlight Links */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <LinkIcon className="w-4 h-4 text-emerald-400" />
              <span>Step 1: Paste Highlight Video Links (1 Se 3 Links)</span>
            </h3>

            <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-bold">
              <Scissors className="w-3.5 h-3.5 text-amber-300" />
              <span>5s Action Multi-Clips &amp; AI Commentary</span>
            </div>
          </div>

          {/* Highlight Links Mode (1 to 3 URLs -> 5s Clips Extraction -> AI Commentary) */}
          <div className="p-5 rounded-2xl bg-slate-900 border border-emerald-500/30 shadow-xl space-y-4">
              <div className="p-3.5 rounded-xl bg-gradient-to-r from-emerald-950/60 via-slate-950 to-teal-950/40 border border-emerald-500/30 text-xs space-y-2">
                <div className="flex items-center gap-2 text-emerald-300 font-bold text-sm">
                  <Scissors className="w-4 h-4 text-amber-400" />
                  <span>5-Second Multi-Clip Action Commentary (1 Se 3 Links)</span>
                </div>
                <p className="text-slate-300 leading-relaxed">
                  Aap jis match ka highlight link yahan denge, system us video me se{" "}
                  <strong className="text-emerald-300">5, 5 seconds ke real action video clips</strong> cut karega. Phir AI
                  dheke ga ke un clips me kya howa (chauka, chakka, wicket, run out) aur un par tezz tareen{" "}
                  <strong className="text-amber-300">Urdu / Hindi commentary</strong> karega. Agar aap 2 ya 3 links denge to
                  un sabhi ke 5-5s clips ko mila kar aik single video banaye ga!
                </p>
              </div>

              {/* Link Input Fields */}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-emerald-400">
                      <LinkIcon className="w-3.5 h-3.5" />
                      Highlight Link #1 (Primary Link - Zaroori)
                    </span>
                    <span className="text-[10px] text-slate-400 font-normal">YouTube Video URL</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="url"
                      value={highlightUrl1}
                      onChange={(e) => setHighlightUrl1(e.target.value)}
                      placeholder="https://www.youtube.com/watch?v=... (Match Highlights Link 1)"
                      className="flex-1 px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs sm:text-sm focus:border-emerald-500 focus:outline-none placeholder:text-slate-500"
                    />
                    {highlightUrl1 && (
                      <button
                        onClick={() => setHighlightUrl1("")}
                        className="px-2.5 py-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white text-xs cursor-pointer"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-slate-300">
                      <LinkIcon className="w-3.5 h-3.5 text-slate-500" />
                      Highlight Link #2 (Optional - Dusra Match Link)
                    </span>
                    <span className="text-[10px] text-slate-400 font-normal">Optional</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="url"
                      value={highlightUrl2}
                      onChange={(e) => setHighlightUrl2(e.target.value)}
                      placeholder="https://www.youtube.com/watch?v=... (Optional 2nd highlight source)"
                      className="flex-1 px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs sm:text-sm focus:border-emerald-500 focus:outline-none placeholder:text-slate-500"
                    />
                    {highlightUrl2 && (
                      <button
                        onClick={() => setHighlightUrl2("")}
                        className="px-2.5 py-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white text-xs cursor-pointer"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-slate-300">
                      <LinkIcon className="w-3.5 h-3.5 text-slate-500" />
                      Highlight Link #3 (Optional - Teesri Video Link)
                    </span>
                    <span className="text-[10px] text-slate-400 font-normal">Optional</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="url"
                      value={highlightUrl3}
                      onChange={(e) => setHighlightUrl3(e.target.value)}
                      placeholder="https://www.youtube.com/watch?v=... (Optional 3rd highlight source)"
                      className="flex-1 px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs sm:text-sm focus:border-emerald-500 focus:outline-none placeholder:text-slate-500"
                    />
                    {highlightUrl3 && (
                      <button
                        onClick={() => setHighlightUrl3("")}
                        className="px-2.5 py-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white text-xs cursor-pointer"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Inspect Button & Quick Action Presets */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleInspectHighlights}
                  disabled={isInspecting || (!highlightUrl1 && !highlightUrl2 && !highlightUrl3)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 transition-all cursor-pointer disabled:opacity-50 flex items-center gap-2"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isInspecting ? "animate-spin text-emerald-400" : ""}`} />
                  <span>{isInspecting ? "Inspecting Video Links..." : "🔍 Inspect Links (Preview Clips)"}</span>
                </button>

                <div className="flex items-center gap-2 text-[11px] text-slate-400">
                  <span>Quick Test Links:</span>
                  <button
                    type="button"
                    onClick={() => {
                      setHighlightUrl1("https://www.youtube.com/watch?v=aqz-KE-bpKQ");
                      setHighlightUrl2("https://www.youtube.com/watch?v=ysz5S6PUM-U");
                      setCustomTitle("Ind vs Eng Thriller & Pak vs Aus Highlights");
                    }}
                    className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-emerald-300 font-semibold cursor-pointer"
                  >
                    Paste 2 Sample Links
                  </button>
                </div>
              </div>

              {inspectError && (
                <div className="p-3 rounded-xl bg-red-950/50 border border-red-800/60 text-xs text-red-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{inspectError}</span>
                </div>
              )}

              {/* Inspected Results Cards */}
              {inspectedItems.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-slate-800">
                  <div className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Links Verified &amp; Ready for 5s Clips Extraction ({inspectedItems.length}):</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {inspectedItems.map((item, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-xl bg-slate-950 border border-emerald-500/40 text-xs space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-white line-clamp-1">{item.title}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                            Link #{idx + 1}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center justify-between">
                          <span>📺 {item.uploader || "Sports Highlights"}</span>
                          <span>⏱️ {item.duration ? `${Math.floor(item.duration / 60)}m ${item.duration % 60}s` : "Video Link"}</span>
                        </div>
                        <div className="text-[11px] text-emerald-300 font-semibold flex items-center gap-1">
                          <Scissors className="w-3 h-3 text-amber-400" />
                          <span>
                            {inspectedItems.length === 1
                              ? "Extracts 6 to 10 clips (5s each)"
                              : inspectedItems.length === 2
                              ? "Extracts 4 clips (5s each)"
                              : "Extracts 3 clips (5s each)"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Smart Highlight Moment Filter */}
              <div className="pt-3 border-t border-slate-800 space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-amber-400">
                      <Flame className="w-3.5 h-3.5" />
                      Highlight Moment Filter (Aap Ko Kya Chahiye?)
                    </span>
                    <span className="text-[10px] text-emerald-400 font-semibold">AI Precise Detection</span>
                  </label>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setFilterMode("all_sixes_fours")}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        filterMode === "all_sixes_fours"
                          ? "bg-amber-950/80 border-amber-500 shadow-md ring-1 ring-amber-500 text-white"
                          : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                      }`}
                    >
                      <div className="flex items-center justify-between font-bold text-xs text-amber-300">
                        <span>💥 Sirf Chakke &amp; Chauke</span>
                        {filterMode === "all_sixes_fours" && <Check className="w-3.5 h-3.5 text-amber-400" />}
                      </div>
                      <div className="text-[10px] text-slate-300 mt-1 leading-tight">
                        Only Sixes &amp; Fours boundary rampage clips
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setFilterMode("all_wickets")}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        filterMode === "all_wickets"
                          ? "bg-red-950/80 border-red-500 shadow-md ring-1 ring-red-500 text-white"
                          : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                      }`}
                    >
                      <div className="flex items-center justify-between font-bold text-xs text-red-300">
                        <span>🎯 Sirf Wickets</span>
                        {filterMode === "all_wickets" && <Check className="w-3.5 h-3.5 text-red-400" />}
                      </div>
                      <div className="text-[10px] text-slate-300 mt-1 leading-tight">
                        Clean bowled, catches &amp; LBW dismissal reel
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setFilterMode("specific_bowler")}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        filterMode === "specific_bowler"
                          ? "bg-purple-950/80 border-purple-500 shadow-md ring-1 ring-purple-500 text-white"
                          : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                      }`}
                    >
                      <div className="flex items-center justify-between font-bold text-xs text-purple-300">
                        <span>⚡ Aik Bowler Ki Wickets</span>
                        {filterMode === "specific_bowler" && <Check className="w-3.5 h-3.5 text-purple-400" />}
                      </div>
                      <div className="text-[10px] text-slate-300 mt-1 leading-tight">
                        Only specific bowler spells (e.g. Shaheen, Bumrah)
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setFilterMode("specific_batsman")}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        filterMode === "specific_batsman"
                          ? "bg-blue-950/80 border-blue-500 shadow-md ring-1 ring-blue-500 text-white"
                          : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                      }`}
                    >
                      <div className="flex items-center justify-between font-bold text-xs text-blue-300">
                        <span>🏏 Aik Batsman Ke Runs</span>
                        {filterMode === "specific_batsman" && <Check className="w-3.5 h-3.5 text-blue-400" />}
                      </div>
                      <div className="text-[10px] text-slate-300 mt-1 leading-tight">
                        Only specific batsman innings (e.g. Babar, Kohli)
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setFilterMode("full_match_highlights")}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer sm:col-span-2 lg:col-span-2 ${
                        filterMode === "full_match_highlights"
                          ? "bg-emerald-950/80 border-emerald-500 shadow-md ring-1 ring-emerald-500 text-white"
                          : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                      }`}
                    >
                      <div className="flex items-center justify-between font-bold text-xs text-emerald-300">
                        <span>🏆 Match / Inning Full Highlights</span>
                        {filterMode === "full_match_highlights" && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                      </div>
                      <div className="text-[10px] text-slate-300 mt-1 leading-tight">
                        Balanced multi-clip breakdown of turning points, big overs &amp; dramatic final finish
                      </div>
                    </button>
                  </div>
                </div>

                {/* Specific Player Name Input with Quick Chips */}
                {(filterMode === "specific_bowler" || filterMode === "specific_batsman") && (
                  <div className="p-3.5 rounded-xl bg-slate-950/90 border border-slate-700 space-y-2">
                    <label className="block text-xs font-bold text-slate-200 flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-amber-300">
                        <span>🎯 Target Player Name (Kis Player Ki Highlights Chahiye?):</span>
                      </span>
                    </label>
                    <input
                      type="text"
                      value={targetPlayerName}
                      onChange={(e) => setTargetPlayerName(e.target.value)}
                      placeholder={filterMode === "specific_bowler" ? "e.g. Shaheen Shah Afridi, Jasprit Bumrah, Haris Rauf" : "e.g. Babar Azam, Virat Kohli, Mohammad Rizwan"}
                      className="w-full px-4 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs sm:text-sm focus:border-emerald-500 focus:outline-none placeholder:text-slate-500"
                    />

                    {/* Quick Player Suggestions */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="text-[10px] text-slate-400">Quick Select:</span>
                      {(filterMode === "specific_bowler"
                        ? ["Shaheen Shah Afridi", "Jasprit Bumrah", "Haris Rauf", "Naseem Shah", "Mitchell Starc", "Rashid Khan"]
                        : ["Babar Azam", "Virat Kohli", "Mohammad Rizwan", "Rohit Sharma", "Fakhar Zaman", "Suryakumar Yadav"]
                      ).map((pName) => (
                        <button
                          key={pName}
                          type="button"
                          onClick={() => setTargetPlayerName(pName)}
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold cursor-pointer transition-all ${
                            targetPlayerName === pName
                              ? "bg-amber-500 text-slate-950 font-bold"
                              : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                          }`}
                        >
                          {pName}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Optional Custom Title & Details */}
              <div className="pt-2 border-t border-slate-800 space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                    Video Title / Headline (Optional)
                  </label>
                  <input
                    type="text"
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    placeholder="e.g. India vs England 5s Action Highlights & Wickets Breakdown"
                    className="w-full px-4 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs sm:text-sm focus:border-emerald-500 focus:outline-none placeholder:text-slate-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                    Special Commentary Focus / Notes (Optional)
                  </label>
                  <textarea
                    rows={2}
                    value={customSummary}
                    onChange={(e) => setCustomSummary(e.target.value)}
                    placeholder="e.g. Focus on Virat Kohli's 6s, Shaheen Afridi's opening spell, and the final over climax..."
                    className="w-full px-4 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:border-emerald-500 focus:outline-none placeholder:text-slate-500"
                  />
                </div>
              </div>
            </div>
        </div>

        {/* Right Col: Video Format & Generator Trigger */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <Sliders className="w-4 h-4 text-emerald-400" />
            <span>Step 2: Video Editing Options</span>
          </h3>

          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-5">
            {/* Format Selector */}
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                Video Format &amp; Duration
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setVideoFormat("long")}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    videoFormat === "long"
                      ? "bg-amber-600/20 border-amber-500 text-white ring-1 ring-amber-500"
                      : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold text-xs text-amber-300">
                    <Film className="w-3.5 h-3.5" /> 16:9 Landscape Video
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">Full Match Highlights Edit</div>
                </button>

                <button
                  type="button"
                  onClick={() => setVideoFormat("short")}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    videoFormat === "short"
                      ? "bg-red-600/20 border-red-500 text-white ring-1 ring-red-500"
                      : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold text-xs text-red-300">
                    <Zap className="w-3.5 h-3.5" /> 9:16 Shorts Edit
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">Vertical Viral Action Clips</div>
                </button>
              </div>
            </div>

            {/* Visual Highlights & Player Portraits Badge */}
            <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-950/60 to-slate-950 border border-emerald-500/30 text-xs space-y-1.5">
              <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Smart Player &amp; 5s Motion Highlights</span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Automatically displays authentic player portraits (Babar Azam, Virat Kohli, Shaheen Afridi, etc.) when their names are mentioned in the commentary, paired with 5-second dynamic stadium motion clips for broadcast television quality.
              </p>
            </div>

            {/* Language & Voice Selector */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span>Commentary Language</span>
                  <span className="text-[10px] text-emerald-400 font-normal">ElevenLabs Multilingual v2</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setLanguageStyle("urdu");
                      if (selectedVoiceId === "auto" || !ELEVENLABS_CURATED_VOICES.some(v => v.id === selectedVoiceId && (v.lang === "urdu" || v.lang === "both"))) {
                        setSelectedVoiceId("aPfeouerZvEVukwmLSP0"); // Haseeb #1 Urdu Pick
                      }
                    }}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      languageStyle === "urdu"
                        ? "bg-emerald-950/80 border-emerald-500 shadow-sm shadow-emerald-950/50"
                        : "bg-slate-950 border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white">Urdu (اردو)</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                        #1: Haseeb
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">High-Energy Sports Voice • 55% Stability</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setLanguageStyle("hindi");
                      if (selectedVoiceId === "auto" || !ELEVENLABS_CURATED_VOICES.some(v => v.id === selectedVoiceId && (v.lang === "hindi" || v.lang === "both"))) {
                        setSelectedVoiceId("Y6nOpHQlW4lnf9GRRc8f"); // Adarsh #1 Hindi Pick
                      }
                    }}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      languageStyle === "hindi"
                        ? "bg-emerald-950/80 border-emerald-500 shadow-sm shadow-emerald-950/50"
                        : "bg-slate-950 border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white">Hindi (हिन्दी)</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold">
                        #1: Adarsh
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">Deep, Authoritative &amp; Emotional</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setLanguageStyle("urdu_hindi")}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      languageStyle === "urdu_hindi"
                        ? "bg-emerald-950/80 border-emerald-500 shadow-sm shadow-emerald-950/50"
                        : "bg-slate-950 border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    <div className="text-xs font-bold text-white">Urdu / Hindi Mix</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">High-energy passionate match commentary</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setLanguageStyle("english");
                      setSelectedVoiceId("ppLqTilh7rH7fbUVlXsf"); // David
                    }}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      languageStyle === "english"
                        ? "bg-emerald-950/80 border-emerald-500 shadow-sm shadow-emerald-950/50"
                        : "bg-slate-950 border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    <div className="text-xs font-bold text-white">English Broadcast</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">International sports commentary tone</div>
                  </button>
                </div>
              </div>

              {/* ElevenLabs Voice Selection Card List */}
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>ElevenLabs Commentary Voice Model</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">
                    ID: {selectedVoiceId === "auto" ? (languageStyle === "hindi" ? "Y6nOpHQlW4lnf9GRRc8f" : "aPfeouerZvEVukwmLSP0") : selectedVoiceId}
                  </span>
                </label>

                <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                  {/* Auto Recommended Option */}
                  <label
                    className={`flex items-start gap-2.5 p-2 rounded-xl border cursor-pointer transition-all ${
                      selectedVoiceId === "auto"
                        ? "bg-emerald-950/60 border-emerald-500"
                        : "bg-slate-950/80 border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    <input
                      type="radio"
                      name="elevenlabs_voice"
                      checked={selectedVoiceId === "auto"}
                      onChange={() => setSelectedVoiceId("auto")}
                      className="accent-emerald-500 mt-1"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white">✨ Auto Recommended (#1 Pick)</span>
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                          {languageStyle === "hindi" ? "Adarsh (Y6nOpHQlW4lnf9GRRc8f)" : "Haseeb (aPfeouerZvEVukwmLSP0)"}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        Automatically routes to the highest-rated commentary voice ({languageStyle === "hindi" ? "Adarsh" : "Haseeb"}) with tuned stability.
                      </div>
                    </div>
                  </label>

                  {/* Filtered Curated Voice List */}
                  {ELEVENLABS_CURATED_VOICES.filter((voice) => {
                    if (languageStyle === "urdu") return voice.lang === "urdu" || voice.lang === "both";
                    if (languageStyle === "hindi") return voice.lang === "hindi" || voice.lang === "both";
                    if (languageStyle === "english") return voice.lang === "english";
                    return true;
                  }).map((voice) => {
                    const isSelected = selectedVoiceId === voice.id;
                    return (
                      <label
                        key={voice.id + voice.badge}
                        className={`flex items-start gap-2.5 p-2 rounded-xl border cursor-pointer transition-all ${
                          isSelected
                            ? "bg-emerald-950/60 border-emerald-500"
                            : "bg-slate-950/80 border-slate-800 hover:border-slate-700"
                        }`}
                      >
                        <input
                          type="radio"
                          name="elevenlabs_voice"
                          checked={isSelected}
                          onChange={() => setSelectedVoiceId(voice.id)}
                          className="accent-emerald-500 mt-1"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-white">{voice.name}</span>
                            <span
                              className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${
                                voice.isTopPick
                                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                  : "bg-slate-800 text-slate-300"
                              }`}
                            >
                              {voice.badge}
                            </span>
                            <span className="text-[9px] text-slate-400 bg-slate-900 px-1 py-0.2 rounded font-mono">
                              {voice.gender.toUpperCase()} • {Math.round(voice.stability * 100)}% STAB
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-300 mt-0.5 leading-snug">
                            {voice.description}
                          </div>
                          <div className="text-[9px] text-slate-400 font-mono mt-0.5">
                            ID: <span className="text-emerald-400">{voice.id}</span>
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Copyright-Free Background Music Selector */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-amber-400">
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>Copyright-Free Background Music 🎵</span>
                </div>
                <span className="text-[10px] text-emerald-400 font-semibold">100% Safe (No Claim)</span>
              </label>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setBgmStyle("high_energy_phonk")}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    bgmStyle === "high_energy_phonk"
                      ? "bg-amber-950/80 border-amber-500 shadow-md ring-1 ring-amber-500 text-white"
                      : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                  }`}
                >
                  <div className="flex items-center justify-between font-bold text-xs text-amber-300">
                    <span>⚡ High Energy Phonk</span>
                    {bgmStyle === "high_energy_phonk" && <Check className="w-3.5 h-3.5 text-amber-400" />}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Viral Shorts Drift Beat</div>
                </button>

                <button
                  type="button"
                  onClick={() => setBgmStyle("stadium_beats")}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    bgmStyle === "stadium_beats"
                      ? "bg-emerald-950/80 border-emerald-500 shadow-md ring-1 ring-emerald-500 text-white"
                      : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                  }`}
                >
                  <div className="flex items-center justify-between font-bold text-xs text-emerald-300">
                    <span>🥁 Stadium Drums</span>
                    {bgmStyle === "stadium_beats" && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Fast Cricket Percussion</div>
                </button>

                <button
                  type="button"
                  onClick={() => setBgmStyle("cinematic_trap")}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    bgmStyle === "cinematic_trap"
                      ? "bg-purple-950/80 border-purple-500 shadow-md ring-1 ring-purple-500 text-white"
                      : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                  }`}
                >
                  <div className="flex items-center justify-between font-bold text-xs text-purple-300">
                    <span>🎧 Cinematic Trap</span>
                    {bgmStyle === "cinematic_trap" && <Check className="w-3.5 h-3.5 text-purple-400" />}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Deep Bass Sports Drop</div>
                </button>

                <button
                  type="button"
                  onClick={() => setBgmStyle("epic_nasheed")}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    bgmStyle === "epic_nasheed"
                      ? "bg-teal-950/80 border-teal-500 shadow-md ring-1 ring-teal-500 text-white"
                      : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                  }`}
                >
                  <div className="flex items-center justify-between font-bold text-xs text-teal-300">
                    <span>🕊️ Epic Nasheed</span>
                    {bgmStyle === "epic_nasheed" && <Check className="w-3.5 h-3.5 text-teal-400" />}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Inspiring Rhythm</div>
                </button>
              </div>
            </div>

            {/* Anti-Copyright Protection Shield Toggle */}
            <div className="p-3.5 rounded-xl bg-gradient-to-br from-slate-950 to-emerald-950/30 border border-emerald-500/30 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs font-bold text-white">Anti-Copyright Shield (Anti-Content ID)</span>
                </div>
                <button
                  type="button"
                  onClick={() => setCopyrightShield(!copyrightShield)}
                  className={`px-2.5 py-1 rounded-full text-[10px] font-bold cursor-pointer transition-all ${
                    copyrightShield
                      ? "bg-emerald-500 text-slate-950"
                      : "bg-slate-800 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {copyrightShield ? "🛡️ ACTIVE (SAFE)" : "OFF"}
                </button>
              </div>
              <div className="text-[10px] text-slate-300 space-y-1">
                <div className="flex items-center gap-1 text-emerald-400">
                  <Check className="w-3 h-3" />
                  <span>1.06x Anti-Bot Zoom &amp; Edge Vignette to Mask Broadcaster Watermarks</span>
                </div>
                <div className="flex items-center gap-1 text-emerald-400">
                  <Check className="w-3 h-3" />
                  <span>CapCut/XML Style HDR Grading (1.10 Contrast, 1.18 Saturation, 0.8 Sharpness)</span>
                </div>
                <div className="flex items-center gap-1 text-emerald-400">
                  <Check className="w-3 h-3" />
                  <span>100% Original Broadcast Audio Stripped + Zero AI Cartoon / Real Footage Preserved</span>
                </div>
              </div>
            </div>

            {/* YouTube Channel Destination */}
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Target YouTube Channel
              </label>
              {connectedToken && channelTitle ? (
                <div className="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-800/60 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span className="font-bold text-white">{channelTitle}</span>
                  </div>
                  <span className="text-[10px] text-emerald-300 font-semibold">Auto-Upload Ready</span>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-2">
                  <div className="text-slate-400">No YouTube channel connected yet.</div>
                  <button
                    onClick={onConnectChannel}
                    className="w-full py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-all cursor-pointer"
                  >
                    Connect YouTube Channel
                  </button>
                </div>
              )}
            </div>

            {/* YouTube Privacy Status */}
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                YouTube Privacy
              </label>
              <select
                value={privacyStatus}
                onChange={(e: any) => setPrivacyStatus(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:border-emerald-500 focus:outline-none"
              >
                <option value="public">Public (Visible to everyone &amp; Search)</option>
                <option value="unlisted">Unlisted (Link only)</option>
                <option value="private">Private (Only you)</option>
              </select>
            </div>

            {/* Generate Trigger Button */}
            <button
              onClick={handleGenerate}
              disabled={isGenerating || isRunning}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-sm shadow-xl shadow-emerald-950/60 hover:shadow-emerald-900/40 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2.5"
            >
              {isGenerating || isRunning ? (
                <>
                  <Activity className="w-5 h-5 animate-spin" />
                  <span>
                    {activeMode === "highlights"
                      ? "Extracting 5s Action Clips & Generating Commentary..."
                      : "Editing & Generating Cricket Video..."}
                  </span>
                </>
              ) : (
                <>
                  <Play className="w-5 h-5 fill-white" />
                  <span>
                    {activeMode === "highlights"
                      ? `⚡ Generate 5s Multi-Clip Video (${videoFormat === "long" ? "16:9 Long" : "9:16 Short"})`
                      : `⚡ Generate & Edit Match Video (${videoFormat === "long" ? "16:9 Landscape" : "9:16 Short"})`}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Previous Run Result & Video Preview (In-App Player & YouTube) */}
      {(lastRun?.youtube || lastRun?.video?.previewUrl || pipelineStatus?.progress?.currentVideoMetadata?.previewUrl) && (
        <div className="p-6 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-900 border-2 border-emerald-500/50 shadow-xl space-y-4">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{lastRun?.youtube ? "Uploaded to YouTube Successfully ✅" : "Video Ready for Review (Preview Mode) 🎬"}</span>
              </div>
              <h4 className="text-lg font-bold text-white">{lastRun?.script?.title || pipelineStatus?.progress?.currentVideoMetadata?.title || "Cricket Documentary"}</h4>
              <p className="text-xs text-slate-400 font-mono select-all">
                {lastRun?.youtube?.videoUrl || (lastRun?.video?.previewUrl ? "Generated and playable directly below" : "")}
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {lastRun?.youtube?.videoUrl ? (
                <a
                  href={lastRun.youtube.videoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-lg shadow-red-950/50 transition-all"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Watch on YouTube</span>
                </a>
              ) : (
                (lastRun?.video?.previewUrl || pipelineStatus?.progress?.currentVideoMetadata?.previewUrl) && (
                  <a
                    href={lastRun?.video?.previewUrl || pipelineStatus?.progress?.currentVideoMetadata?.previewUrl}
                    download="cricket_video.mp4"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-950/50 transition-all cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download MP4</span>
                  </a>
                )
              )}
            </div>
          </div>

          {/* If YouTube published, show YouTube embed; else show native HTML5 video player */}
          {lastRun?.youtube?.videoId ? (
            <div className="aspect-video max-w-xl mx-auto rounded-xl overflow-hidden shadow-lg border border-slate-800">
              <iframe
                src={`https://www.youtube.com/embed/${lastRun.youtube.videoId}`}
                title="Cricket Documentary Video"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full"
              />
            </div>
          ) : (lastRun?.video?.previewUrl || pipelineStatus?.progress?.currentVideoMetadata?.previewUrl) ? (
            <div className="max-w-xl mx-auto rounded-xl overflow-hidden shadow-2xl border border-emerald-500/40 bg-black p-2">
              <video
                src={lastRun?.video?.previewUrl || pipelineStatus?.progress?.currentVideoMetadata?.previewUrl}
                controls
                autoPlay={false}
                className="w-full rounded-lg max-h-[460px] object-contain mx-auto bg-black"
              />
              <p className="text-[11px] text-center text-slate-400 mt-2">
                Aap video ko play karke check kar sakte hain. Agar video theek hai toh Live Tracker mein "Upload to YouTube" button daba sakte hain.
              </p>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
