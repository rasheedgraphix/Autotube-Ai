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
  const [videoFormat, setVideoFormat] = useState<"short" | "long">("short");
  const [targetMinutes, setTargetMinutes] = useState<number>(3);
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
    if (!customPrompt.trim()) {
      setErrorMsg("Barahe karam video banane ke liye prompt aur detail zaroor likhein!");
      return;
    }

    setErrorMsg(null);
    setSuccessMsg(null);
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/scheduler/daily-run", {
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
          customPrompt: customPrompt.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || data.success === false) {
        throw new Error(data.error || data.message || "Video generation start nahi ho saki.");
      }

      setSuccessMsg(
        `Video generation shuru ho chuki hai! (${videoFormat === "long" ? "Long Video" : "Shorts"}, ~${targetMinutes} Minutes). Aap Live Pipeline Tracker mein real-time progress dekh sakte hain.`
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
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-purple-950/40 to-slate-900 border border-purple-500/30 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/20 border border-purple-500/40 text-purple-300 text-xs font-bold mb-2">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Prompt-to-Video AI Studio</span>
            </div>
            <h2 className="text-2xl font-black text-white">Custom Prompt Video Generator</h2>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl">
              Aap apne alfaz mein prompt likhein: <strong>video kitne minute ki ho</strong>,{" "}
              <strong>kis topic par ho</strong>, <strong>pehle kya dikhaye</strong>, <strong>uske baad kya ho</strong>, aur{" "}
              <strong>aakhir mein kya bayan kare</strong>. System 100% professional story arc ke sath video banayega.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {connectedToken ? (
              <div className="px-3.5 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Channel: {channelTitle || "Connected"}</span>
              </div>
            ) : (
              <button
                type="button"
                onClick={onConnectChannel}
                className="px-3.5 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
              >
                <span>Connect YouTube Channel</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Notifications */}
      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-950/80 border border-red-700/60 text-red-200 text-xs flex items-center gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-400" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-950/80 border border-emerald-700/60 text-emerald-200 text-xs flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-400" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Main Generator Card */}
      <form onSubmit={handleGenerateFromPrompt} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Form Inputs */}
        <div className="lg:col-span-8 space-y-6">
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm space-y-5">
            {/* Topic Field */}
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                1. Video Topic / Name (Mauzooh)
              </label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. Deep Ocean Mysteries, James Webb Space Discovery, Human Brain Facts..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-colors"
              />
            </div>

            {/* Custom Prompt or Full Script Text Area */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <FileText className="w-3.5 h-3.5 text-purple-400" />
                  <span>2. Aapka Prompt YA Poora Tayar Script (Paste Script or Prompt)</span>
                </label>
                <span className="text-[11px] text-purple-400 font-medium">Script &amp; Story Arc</span>
              </div>

              <textarea
                rows={8}
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="Yahan 2 options hain:

Option A (Poora Script):
Agar aapke paas tayar script hai, to poora script yahan paste kar dein. AI usi script ke jumlay boley ga aur har line ke mutabiq cinematic visuals banayega.

Option B (Step-by-step Prompt):
1. Pehle kya shuru ho (Opening Hook / Hairat-angez sawal)
2. Uske baad kya mechanism ya backstory samjhaye
3. Uske baad kya turning point ya shock reveal ho
4. Aur aakhir mein kya natija nikle aur subscribe karne ka bole..."
                className="w-full p-4 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 leading-relaxed font-mono text-xs transition-colors"
              />
              <p className="text-[11px] text-slate-400 mt-1.5">
                💡 <strong>Script ya Prompt:</strong> Agar aap poora script paste karenge to voice-over mein aapka hi script bola jayega. Agar prompt denge to AI aapki hidayat ke mutabiq story build karega.
              </p>
            </div>

            {/* Format & Duration Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-800">
              {/* Format Switcher */}
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
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
                        ? "bg-purple-950/60 border-purple-500 text-white shadow-md ring-1 ring-purple-400"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-purple-400" />
                      <span className="text-xs font-bold">Shorts (9:16)</span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">Vertical up to 3 Min</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setVideoFormat("long");
                      if (targetMinutes < 5) setTargetMinutes(8);
                    }}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      videoFormat === "long"
                        ? "bg-purple-950/60 border-purple-500 text-white shadow-md ring-1 ring-purple-400"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Film className="w-4 h-4 text-purple-400" />
                      <span className="text-xs font-bold">Long Video (16:9)</span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">Full HD 8+ Min Doc</p>
                  </button>
                </div>
              </div>

              {/* Exact Minutes Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center justify-between">
                  <span>4. Video Duration (Kitne Minute)</span>
                  <span className="text-purple-400 font-mono text-xs">{targetMinutes} Minutes</span>
                </label>

                {videoFormat === "short" ? (
                  <div className="grid grid-cols-3 gap-2">
                    {[1, 2, 3].map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setTargetMinutes(m)}
                        className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                          targetMinutes === m
                            ? "bg-purple-600 border-purple-400 text-white shadow-md"
                            : "bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700"
                        }`}
                      >
                        {m} Min
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
                        className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                          targetMinutes === m
                            ? "bg-purple-600 border-purple-400 text-white shadow-md"
                            : "bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700"
                        }`}
                      >
                        {m} Min
                      </button>
                    ))}
                  </div>
                )}
                <p className="text-[10px] text-slate-400 mt-1.5">
                  AI aapke bataye gaye duration ke hisab se scenes aur spoken word count organize karega.
                </p>
              </div>
            </div>

            {/* Language & Voice Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-800">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  5. Zuban (Language)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setLanguageStyle("urdu")}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      languageStyle === "urdu"
                        ? "bg-purple-950/60 border-purple-500 text-white ring-1 ring-purple-400"
                        : "bg-slate-950 border-slate-800 text-slate-400"
                    }`}
                  >
                    Roman Urdu / Hindi
                  </button>
                  <button
                    type="button"
                    onClick={() => setLanguageStyle("english")}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      languageStyle === "english"
                        ? "bg-purple-950/60 border-purple-500 text-white ring-1 ring-purple-400"
                        : "bg-slate-950 border-slate-800 text-slate-400"
                    }`}
                  >
                    English
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  6. YouTube Privacy
                </label>
                <select
                  value={privacyStatus}
                  onChange={(e: any) => setPrivacyStatus(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-200 text-xs focus:outline-none focus:border-purple-500"
                >
                  <option value="public">Public (Turant live ho jaye)</option>
                  <option value="unlisted">Unlisted (Link wale dekh sakein)</option>
                  <option value="private">Private (Pehle khud review karein)</option>
                </select>
              </div>
            </div>

            {/* Submit Action Button */}
            <div className="pt-3">
              <button
                type="submit"
                disabled={isSubmitting || !customPrompt.trim()}
                className={`w-full py-3.5 px-6 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-lg cursor-pointer ${
                  isSubmitting || !customPrompt.trim()
                    ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                    : "bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-purple-950 ring-1 ring-purple-400"
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
                    <span>Prompt Se Video Banao (~{targetMinutes} Min {videoFormat === "long" ? "Long" : "Shorts"})</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Templates & Story Arc Guide */}
        <div className="lg:col-span-4 space-y-5">
          {/* Story Arc Guide */}
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
            <h3 className="text-xs font-bold text-purple-400 uppercase tracking-wider flex items-center gap-1.5">
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Professional Video Structure</span>
            </h3>
            <div className="text-[11px] text-slate-300 space-y-2 leading-relaxed">
              <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80">
                <span className="font-bold text-amber-400">1. Opening Hook:</span> Pehle 3 second mein shock ya curiosity gap paida karein.
              </div>
              <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80">
                <span className="font-bold text-cyan-400">2. Step-by-Step Details:</span> Uske baad mechanics, reality aur facts tafseel se bayan karein.
              </div>
              <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80">
                <span className="font-bold text-rose-400">3. Turning Point / Twist:</span> Beech mein sab se hairan-kun point samjhayein.
              </div>
              <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80">
                <span className="font-bold text-emerald-400">4. Satisfying Outro:</span> Aakhir mein baat poori karein aur channel subscribe karne ka bole.
              </div>
            </div>
          </div>

          {/* Click-to-Apply Example Prompts */}
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Prompt Ke Examples (Click Karein)
            </h3>
            <div className="space-y-2">
              {samplePrompts.map((tmpl, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleApplyTemplate(tmpl)}
                  className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-purple-500/60 text-left transition-all group cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-200 group-hover:text-purple-300">
                      {tmpl.title}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-purple-950/80 text-purple-300 border border-purple-800">
                      {tmpl.minutes} Min {tmpl.format === "long" ? "Long" : "Short"}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">
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
