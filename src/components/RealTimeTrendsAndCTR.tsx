import React, { useState, useEffect } from "react";
import {
  Flame,
  TrendingUp,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Zap,
  Tag,
  Search,
  ArrowRight,
  RefreshCw,
  BarChart3,
  Calendar,
  Check,
} from "lucide-react";

export interface RealTimeTrendItem {
  id: string;
  topic: string;
  niche: string;
  currentSearchVolume: string;
  projectedCTR: number;
  trendingRank: number;
  urgency: "CRITICAL (Live Today)" | "HIGH (Yesterday Climax)" | "HOT (Trending This Week)";
  whyTrendingToday: string;
  recommendedHook: string;
  powerTags: string[];
}

interface RealTimeTrendsAndCTRProps {
  onSelectTopic?: (topic: string, hook: string) => void;
}

export default function RealTimeTrendsAndCTR({ onSelectTopic }: RealTimeTrendsAndCTRProps) {
  const [trends, setTrends] = useState<RealTimeTrendItem[]>([]);
  const [todayDate, setTodayDate] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [copiedTag, setCopiedTag] = useState<string | null>(null);

  // Live Title CTR Tester state
  const [testTitle, setTestTitle] = useState("");
  const [isShortFormat, setIsShortFormat] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [ctrResult, setCtrResult] = useState<any>(null);

  const fetchTrends = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/seo/realtime-trends");
      const data = await res.json();
      if (data.success && Array.isArray(data.trends)) {
        setTrends(data.trends);
        setTodayDate(data.todayDate);
      }
    } catch (err) {
      console.warn("Failed to load real-time trends:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTrends();
  }, []);

  const handleEvaluateCTR = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!testTitle.trim()) return;

    setIsEvaluating(true);
    try {
      const res = await fetch("/api/seo/evaluate-ctr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: testTitle.trim(),
          niche: "Cricket Highlights",
          isShort: isShortFormat,
        }),
      });
      const data = await res.json();
      if (data.success && data.analysis) {
        setCtrResult(data.analysis);
      }
    } catch (err) {
      console.warn("Failed to evaluate CTR:", err);
    } finally {
      setIsEvaluating(false);
    }
  };

  return (
    <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-2xl space-y-6">
      {/* Header with Verification Stamp */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
              Live Verification Active
            </span>
            {todayDate && (
              <span className="text-xs text-slate-400 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {todayDate}
              </span>
            )}
          </div>
          <h2 className="text-lg sm:text-xl font-black text-white mt-1.5 flex items-center gap-2">
            <Flame className="w-5 h-5 text-amber-400 fill-amber-400" />
            <span>Aaj Kya Chal Raha Hai? (Highest CTR Topic Verification)</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-3xl">
            Real-time verification showing what audiences are searching right now, which topics have the highest
            Click-Through Rate (CTR), and why they are going viral today.
          </p>
        </div>

        <button
          onClick={fetchTrends}
          disabled={isLoading}
          className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold border border-slate-700 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 self-start sm:self-auto shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-emerald-400" : ""}`} />
          <span>Refresh Live Trends</span>
        </button>
      </div>

      {/* Top Trending Topics Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <span>Verified High-CTR Trending Topics ({trends.length})</span>
          </span>
          <span className="text-xs text-emerald-400 font-bold">
            Sorted by Projected CTR%
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {trends.map((item) => (
            <div
              key={item.id}
              className="p-4 rounded-2xl bg-slate-950 border border-slate-800 hover:border-emerald-500/40 transition-all group space-y-3"
            >
              {/* Header Badge & CTR */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 font-black text-xs flex items-center justify-center">
                    #{item.trendingRank}
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-slate-800 text-[10px] font-bold text-slate-300">
                    {item.urgency}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border border-emerald-500/40 text-emerald-300 font-black text-xs">
                  <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                  <span>{item.projectedCTR}% CTR</span>
                </div>
              </div>

              {/* Title & Volume */}
              <div>
                <h3 className="text-sm font-bold text-white group-hover:text-emerald-300 transition-colors line-clamp-2">
                  {item.topic}
                </h3>
                <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-1">
                  <span className="text-amber-400 font-semibold">{item.currentSearchVolume}</span>
                  <span>•</span>
                  <span>{item.niche}</span>
                </div>
              </div>

              {/* Why Trending Today */}
              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800/80 text-[11px] text-slate-300">
                <span className="font-bold text-emerald-400">Aaj Kyun Trending Hai: </span>
                <span>{item.whyTrendingToday}</span>
              </div>

              {/* Hook text */}
              <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                <span className="font-bold text-slate-300">Thumbnail Hook:</span>
                <span className="text-amber-300 font-bold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 truncate">
                  "{item.recommendedHook}"
                </span>
              </div>

              {/* Action buttons */}
              <div className="flex items-center justify-between pt-1 border-t border-slate-900">
                <div className="flex items-center gap-1 flex-wrap">
                  {item.powerTags.slice(0, 3).map((tag, idx) => (
                    <span
                      key={idx}
                      className="text-[10px] text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>

                {onSelectTopic && (
                  <button
                    onClick={() => onSelectTopic(item.topic, item.recommendedHook)}
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md shadow-emerald-950 flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    <span>Use Topic</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Live Title CTR Evaluator Tool */}
      <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Live CTR &amp; Hook Evaluator (Apna Title / Idea Test Karein)
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <button
              type="button"
              onClick={() => setIsShortFormat(false)}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                !isShortFormat ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40" : "text-slate-400 hover:text-white"
              }`}
            >
              16:9 Long Video
            </button>
            <button
              type="button"
              onClick={() => setIsShortFormat(true)}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                isShortFormat ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40" : "text-slate-400 hover:text-white"
              }`}
            >
              9:16 Short
            </button>
          </div>
        </div>

        <form onSubmit={handleEvaluateCTR} className="flex gap-2">
          <input
            type="text"
            value={testTitle}
            onChange={(e) => setTestTitle(e.target.value)}
            placeholder="Type any video title to test its predicted CTR (e.g. IND vs ENG: Bumrah Last Over Miracle Defends 4 Runs!)..."
            className="flex-1 px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs sm:text-sm focus:border-emerald-500 focus:outline-none placeholder:text-slate-500"
          />
          <button
            type="submit"
            disabled={isEvaluating || !testTitle.trim()}
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all disabled:opacity-50 cursor-pointer flex items-center gap-1.5 shrink-0"
          >
            {isEvaluating ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Zap className="w-3.5 h-3.5" />
            )}
            <span>Calculate CTR</span>
          </button>
        </form>

        {/* Evaluation Output Card */}
        {ctrResult && (
          <div className="p-4 rounded-xl bg-slate-900 border border-emerald-500/40 space-y-3 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-2xl font-black text-emerald-400">
                  {ctrResult.predictedCTR}%
                </span>
                <div>
                  <div className="text-xs font-bold text-white">Projected Click-Through Rate</div>
                  <div className="text-[11px] text-emerald-300">{ctrResult.ctrVerdict}</div>
                </div>
              </div>

              <div className="flex items-center gap-3 text-xs">
                <div className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-center">
                  <div className="text-[10px] text-slate-400">Curiosity Score</div>
                  <div className="font-bold text-amber-300">{ctrResult.curiosityScore}/100</div>
                </div>
                <div className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-center">
                  <div className="text-[10px] text-slate-400">Urgency Score</div>
                  <div className="font-bold text-cyan-300">{ctrResult.urgencyScore}/100</div>
                </div>
                <div className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-center">
                  <div className="text-[10px] text-slate-400">Search Volume</div>
                  <div className="font-bold text-purple-300">{ctrResult.searchVolumeScore}/100</div>
                </div>
              </div>
            </div>

            <div className="text-xs text-slate-300 p-2.5 rounded-lg bg-slate-950 border border-slate-800/80">
              <span className="font-bold text-emerald-400">Algorithmic Recommendation: </span>
              <span>{ctrResult.recommendation}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
