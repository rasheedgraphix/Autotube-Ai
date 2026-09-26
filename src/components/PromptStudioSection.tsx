import React, { useState } from "react";
import {
  Sparkles,
  Play,
  Film,
  Zap,
  Clock,
  FileText,
  Volume2,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Radio,
  Eye,
  Sliders,
  Send,
} from "lucide-react";
import { safeFetchJson } from "../utils/safeFetch";

interface Props {
  connectedToken: string | null;
  channelTitle?: string | null;
  onConnectChannel: () => void;
  onNavigateToTracker?: () => void;
}

export default function PromptStudioSection({
  connectedToken,
  channelTitle,
  onConnectChannel,
  onNavigateToTracker,
}: Props) {
  const [topic, setTopic] = useState("");
  const [customPrompt, setCustomPrompt] = useState("");
  const [customScript, setCustomScript] = useState("");
  const [autoPublish, setAutoPublish] = useState<boolean>(true);
  const [videoFormat, setVideoFormat] = useState<"short" | "long">("short");
  const [targetMinutes, setTargetMinutes] = useState<number>(1);
  const [languageStyle, setLanguageStyle] = useState<"urdu" | "english">("urdu");
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>("auto");
  const [privacyStatus, setPrivacyStatus] = useState<"public" | "unlisted" | "private">("public");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Pre-crafted prompt templates for inspiration
  const samplePrompts = [
    {
      title: "🌌 Mariana Trench Secret",
      format: "short" as const,
      minutes: 3,
      lang: "urdu" as const,
      topic: "Deepest Ocean Secret",
      prompt:
        "Mariana Trench ke sab se gehre point Challenger Deep ke baare mein video banao. Pehle batao ke kitna gehra hai aur insan kyun nahi ja sakta. Phir step-by-step batao ke wahan kis tarah ke ajeeb-o-ghareeb creatures rehte hain aur kitna shadeed pressure hai. Aakhir mein robotic submersible ki shocking discovery batao aur viewers ko subscribe karne ka bolo.",
    },
    {
      title: "🚀 James Webb Telescope Discovery",
      format: "long" as const,
      minutes: 8,
      lang: "urdu" as const,
      topic: "James Webb Discovery",
      prompt:
        "James Webb Space Telescope ki 8 minute ki in-depth documentary banao. Start karo telescope ke launch aur golden mirrors ke unfold hone ke suspense se. Uske baad step-by-step pehli deep field image, ancient galaxies, aur exoplanet atmospheres ki scientific haqeeqat batao. Aakhir mein iska human history aur universe ke origins par asar samjhao aur subscribe CTA shamil karo.",
    },
    {
      title: "🦁 Black Hole Event Horizon",
      format: "short" as const,
      minutes: 3,
      lang: "urdu" as const,
      topic: "Black Hole Paradox",
      prompt:
        "Supermassive Black Hole ke Event Horizon ke baare mein 3 minute ka viral short banao. Shuru mein shocking question pucho: agar koi insan black hole mein gir jaye to kya hoga? Uske baad spaghettification, time dilation ka asar step-by-step batao. Aakhir mein Hawking Radiation ka hairan-kun twist batao aur channel subscribe karne ko kaho.",
    },
  ];

  const handleApplyTemplate = (tmpl: (typeof samplePrompts)[0]) => {
    setTopic(tmpl.topic);
    setCustomPrompt(tmpl.prompt);
    setVideoFormat(tmpl.format);
    setTargetMinutes(tmpl.minutes);
    setLanguageStyle(tmpl.lang);
    setErrorMsg(null);
  };

  const handleGenerateFromPrompt = async (e: React.FormEvent) => {
    e.preventDefault();
    const effectiveText = customScript.trim() || customPrompt.trim();
    if (!effectiveText && !topic.trim()) {
      setErrorMsg("Barahe karam prompt ya script darj karein!");
      return;
    }

    setErrorMsg(null);
    setSuccessMsg(null);
    setIsSubmitting(true);

    try {
      const isDirectScript = Boolean(customScript.trim());
      const promptPayload = isDirectScript
        ? `USE EXACT SCRIPT WORD FOR WORD: ${customScript.trim()}`
        : customPrompt.trim();

      const { ok, data, error } = await safeFetchJson<any>("/api/scheduler/daily-run", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(connectedToken ? { Authorization: `Bearer ${connectedToken}` } : {}),
        },
        body: JSON.stringify({
          privacyStatus,
          overrideNiche: topic.trim() || undefined,
          videoFormat,
          targetDurationMinutes: Number(targetMinutes) || (videoFormat === "long" ? 8 : 3),
          languageStyle,
          voiceId: selectedVoiceId === "auto" ? undefined : selectedVoiceId,
          customPrompt: promptPayload,
          autoUpload: autoPublish,
        }),
      });

      if (!ok || data?.success === false) {
        throw new Error(error || data?.error || data?.message || "Video generation start nahi ho saki.");
      }

      setSuccessMsg(
        `Video generation shuru ho chuki hai! (${videoFormat === "long" ? "Long Video" : "Shorts"}, ~${targetMinutes} Minutes). ${
          autoPublish ? "Ban'nay ke baad khud YouTube par upload ho jayegi." : "Ban'nay ke baad pehle preview dikhayegi."
        }`
      );

      if (onNavigateToTracker) {
        setTimeout(onNavigateToTracker, 1500);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to start prompt video generation.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Header */}
      <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-purple-400 font-semibold mb-1">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Prompt-to-Video AI Studio</span>
            </div>
            <h2 className="text-xl font-bold text-white">Custom Prompt Video Generator</h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl leading-relaxed">
              Apne alfaz mein video ka prompt ya poora script darj karein. System exact story arc, cinematic visuals, aur voiceover generate karega.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {connectedToken ? (
              <div className="px-3.5 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Channel: {channelTitle || "Connected"}</span>
              </div>
            ) : (
              <button
                type="button"
                onClick={onConnectChannel}
                className="px-3.5 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-semibold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
              >
                <span>Connect YouTube Channel</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Notifications */}
      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-950/40 border border-red-800/60 text-red-200 text-xs flex items-center gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-400" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-800/60 text-emerald-200 text-xs flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-400" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Main Generator Card */}
      <form onSubmit={handleGenerateFromPrompt} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Form Inputs */}
        <div className="lg:col-span-8 space-y-6">
          <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-sm space-y-5">
            {/* Topic Field */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                1. Video Topic / Name (Mauzooh)
              </label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. Alaska ki Horror Story, Bermuda Triangle Mystery, Cricket Miracle..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:border-purple-500 transition-colors"
              />
            </div>

            {/* Input Box 1: Custom Prompt Input */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                  <span>2. Prompt Se Video Banayein (AI Script, Hook & Story Khud Banayega)</span>
                </label>
                <span className="text-[11px] text-purple-400 font-medium">Prompt Box</span>
              </div>
              <textarea
                rows={4}
                value={customPrompt}
                onChange={(e) => {
                  setCustomPrompt(e.target.value);
                  if (customScript.trim()) setCustomScript("");
                }}
                placeholder="Prompt likhein: e.g. Alaska ki sardi mein kho jane wale shakhs ki khaufnak kahani. Pehle suspense shuru ho, darmiyan mein ajeeb awaazein aur aakhir mein hairat-angez inkeshaf..."
                className="w-full p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 text-xs focus:outline-none focus:border-purple-500 leading-relaxed font-mono transition-colors"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Yahan sirf prompt likhein — AI khud high-CTR title, description, tags, hashtags aur poori kahani likhega.
              </p>
            </div>

            {/* Input Box 2: Dedicated Prepared Script Input */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-2">
                  <FileText className="w-3.5 h-3.5 text-cyan-400" />
                  <span>3. Apna Tayyar Script Yahan Dalein (Agar Aapka Apna Script Hai)</span>
                </label>
                <span className="text-[11px] text-cyan-400 font-medium">Dedicated Script Box</span>
              </div>
              <textarea
                rows={5}
                value={customScript}
                onChange={(e) => {
                  setCustomScript(e.target.value);
                  if (customPrompt.trim()) setCustomPrompt("");
                }}
                placeholder="Agar aapne pehle se script likha hua hai, toh yahan paste karein. AI lafz ba lafz yehi script boley ga aur isi ke hisaab se visuals aur Hormozi subtitles lagayega."
                className="w-full p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 text-xs focus:outline-none focus:border-cyan-500 leading-relaxed font-mono transition-colors"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Aapka script aate hi AI automatic SEO Title, Description, Tags aur #Hashtags generate kar dega.
              </p>
            </div>

            {/* Format & Duration Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-800/80">
              {/* Format Switcher */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  3. Video Format
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setVideoFormat("short");
                      if (targetMinutes > 3) setTargetMinutes(3);
                    }}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      videoFormat === "short"
                        ? "bg-slate-800 border-purple-500/80 text-white shadow-sm"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-purple-400" />
                      <span className="text-xs font-semibold">Shorts (9:16)</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">Vertical up to 3 Min</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setVideoFormat("long");
                      if (targetMinutes < 5) setTargetMinutes(8);
                    }}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      videoFormat === "long"
                        ? "bg-slate-800 border-purple-500/80 text-white shadow-sm"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Film className="w-4 h-4 text-purple-400" />
                      <span className="text-xs font-semibold">Long Video (16:9)</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">Full HD 8+ Min Doc</p>
                  </button>
                </div>
              </div>

              {/* Exact Minutes Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
                  <span>4. Video Duration</span>
                  <span className="text-purple-400 font-mono text-xs tabular-nums">{targetMinutes} Minutes</span>
                </label>

                {videoFormat === "short" ? (
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { m: 1, label: "1 Min (Fast / 2G-3G)" },
                      { m: 2, label: "2 Min (Balanced)" },
                      { m: 3, label: "3 Min (Full Short)" },
                    ].map(({ m, label }) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setTargetMinutes(m)}
                        className={`py-2 px-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                          targetMinutes === m
                            ? "bg-slate-800 border-purple-500/80 text-white shadow-sm"
                            : "bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700"
                        }`}
                      >
                        <div className="text-xs font-bold tabular-nums">{m} Min</div>
                        <div className="text-[10px] text-slate-400 mt-0.5 truncate">{label.split(" ")[1] || ""}</div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {[5, 8, 10].map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setTargetMinutes(m)}
                        className={`py-2 px-3 rounded-xl border text-xs font-semibold tabular-nums transition-all cursor-pointer ${
                          targetMinutes === m
                            ? "bg-slate-800 border-purple-500/80 text-white shadow-sm"
                            : "bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700"
                        }`}
                      >
                        {m} Min
                      </button>
                    ))}
                  </div>
                )}
                <p className="text-[11px] text-slate-400 mt-1.5">
                  AI aapke duration ke mutabiq scenes aur spoken narration arrange karega.
                </p>
              </div>
            </div>

            {/* Language & Voice Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-800/80">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  5. Zuban (Language)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setLanguageStyle("urdu")}
                    className={`py-2 px-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                      languageStyle === "urdu"
                        ? "bg-slate-800 border-purple-500/80 text-white shadow-sm"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    Roman Urdu / Hindi
                  </button>
                  <button
                    type="button"
                    onClick={() => setLanguageStyle("english")}
                    className={`py-2 px-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                      languageStyle === "english"
                        ? "bg-slate-800 border-purple-500/80 text-white shadow-sm"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    English
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  6. YouTube Privacy &amp; Auto-Publish
                </label>
                <div className="space-y-2">
                  <select
                    value={privacyStatus}
                    onChange={(e: any) => setPrivacyStatus(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-purple-500 transition-colors"
                  >
                    <option value="public">Public (Direct Live On YouTube)</option>
                    <option value="unlisted">Unlisted (Link wale dekh sakein)</option>
                    <option value="private">Private (Pehle khud review karein)</option>
                  </select>

                  <label className="flex items-center gap-2 cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={autoPublish}
                      onChange={(e) => setAutoPublish(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-purple-600 focus:ring-purple-500"
                    />
                    <span className="text-xs text-emerald-400 font-semibold">
                      Khud direct YouTube par publish karein (Auto-Publish ON)
                    </span>
                  </label>
                </div>
              </div>
            </div>

            {/* Submit Action Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting || (!customPrompt.trim() && !customScript.trim() && !topic.trim())}
                className={`w-full py-3.5 px-6 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer ${
                  isSubmitting || (!customPrompt.trim() && !customScript.trim() && !topic.trim())
                    ? "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50"
                    : "bg-purple-600 hover:bg-purple-500 text-white shadow-purple-950/40 border border-purple-500"
                }`}
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Video Pipeline Start Ho Rahi Hai...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Video Generate Aur Auto-Publish Karein ({targetMinutes} Min {videoFormat === "long" ? "Long" : "Shorts"})</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Templates & Story Arc Guide */}
        <div className="lg:col-span-4 space-y-5">
          {/* Story Arc Guide */}
          <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-sm space-y-3">
            <h3 className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <HelpCircle className="w-4 h-4 text-purple-400" />
              <span>Professional Video Structure</span>
            </h3>
            <div className="text-xs text-slate-300 space-y-2 leading-relaxed">
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80">
                <span className="font-semibold text-amber-400">1. Opening Hook:</span> Pehle 3 second mein shock ya curiosity gap paida karein.
              </div>
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80">
                <span className="font-semibold text-cyan-400">2. Step-by-Step Details:</span> Uske baad mechanics, reality aur facts tafseel se bayan karein.
              </div>
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80">
                <span className="font-semibold text-rose-400">3. Turning Point:</span> Beech mein sab se hairan-kun point samjhayein.
              </div>
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80">
                <span className="font-semibold text-emerald-400">4. Satisfying Outro:</span> Aakhir mein baat poori karein aur channel subscribe karne ka bole.
              </div>
            </div>
          </div>

          {/* Click-to-Apply Example Prompts */}
          <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-sm space-y-3">
            <h3 className="text-xs font-semibold text-slate-300">
              Prompt Ke Examples (Click Karein)
            </h3>
            <div className="space-y-2">
              {samplePrompts.map((tmpl, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleApplyTemplate(tmpl)}
                  className="w-full p-3.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-purple-500/50 text-left transition-all group cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-200 group-hover:text-purple-300">
                      {tmpl.title}
                    </span>
                    <span className="text-[11px] text-purple-400 font-mono tabular-nums">
                      {tmpl.minutes}m {tmpl.format === "long" ? "Long" : "Short"}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1.5 line-clamp-2 leading-relaxed">
                    {tmpl.prompt}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
