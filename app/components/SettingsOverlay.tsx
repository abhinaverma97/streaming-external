"use client";

import { useState, useEffect, useRef } from "react";
import { X, ChevronDown } from "lucide-react";
import { SOURCES } from "../lib/sources-config";
import { buildRecommendationPrompt } from "../lib/format-ratings";

interface SettingsOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onSourcesChange: (enabled: string[], defaultSource: string) => void;
  initialEnabled?: string[];
  initialDefaultSource?: string;
  username?: string;
}

export default function SettingsOverlay({ isOpen, onClose, onSourcesChange, initialEnabled, initialDefaultSource, username }: SettingsOverlayProps) {
  const [enabled, setEnabled] = useState<string[]>([]);
  const [defaultSource, setDefaultSource] = useState("videasy");
  const [selectOpen, setSelectOpen] = useState(false);
  const selectRef = useRef<HTMLDivElement>(null);

  const [aiSettings, setAiSettings] = useState({ apiKey: "", model: "openai/gpt-oss-120b:free" });
  const aiSettingsRef = useRef(aiSettings);
  useEffect(() => { aiSettingsRef.current = aiSettings; }, [aiSettings]);
  // Tracks whether the user has actually edited the API key field.
  // Prevents persisting the value back when the field was never touched.
  const apiKeyDirtyRef = useRef(false);
  const [logTokens, setLogTokens] = useState<number | null>(null);
  const [aiPayload, setAiPayload] = useState<string>("");
  const [copiedPayload, setCopiedPayload] = useState(false);
  const [modelSelectOpen, setModelSelectOpen] = useState(false);
  const modelSelectRef = useRef<HTMLDivElement>(null);
  const [adminStats, setAdminStats] = useState<{ userCount: number; ratingCount: number; watchlistCount: number } | null>(null);
  const [aiModels, setAiModels] = useState<{ id: string; name: string; context: string }[]>([
    { id: "google/gemini-2.0-pro-exp-02-05:free", name: "Gemini 2.0 Pro Exp", context: "2000k Context" },
    { id: "google/gemini-2.0-flash-thinking-exp:free", name: "Gemini 2.0 Flash Thinking", context: "1000k Context" },
    { id: "google/gemini-2.0-flash-lite-preview-02-05:free", name: "Gemini 2.0 Flash Lite", context: "1000k Context" },
    { id: "google/gemini-2.5-pro-exp:free", name: "Gemini 2.5 Pro Exp", context: "2000k Context" },
    { id: "openai/gpt-oss-120b:free", name: "GPT OSS 120B", context: "120k Context" }
  ]);

  const toggleSource = (id: string) => {
    setEnabled((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      const newDefault = next.includes(defaultSource) ? defaultSource : next[0] || "videasy";
      if (newDefault !== defaultSource) setDefaultSource(newDefault);
      onSourcesChange(next, newDefault);
      return next;
    });
  };

  const setNewDefault = (id: string) => {
    setDefaultSource(id);
    setSelectOpen(false);
    onSourcesChange(enabled, id);
  };

  useEffect(() => {
    if (isOpen) {
      // Seed source prefs from parent state if provided; only fall back to
      // the network when the parent didn't pass anything in (legacy callers).
      if (initialEnabled && initialEnabled.length > 0) {
        setEnabled(initialEnabled);
        setDefaultSource(
          initialDefaultSource && SOURCES.some((s) => s.id === initialDefaultSource)
            ? initialDefaultSource
            : (initialEnabled.includes("videasy") ? "videasy" : initialEnabled[0])
        );
      } else if (initialEnabled !== undefined) {
        // Parent explicitly passed [] meaning "enable all".
        setEnabled(SOURCES.map((s) => s.id));
        setDefaultSource(initialDefaultSource || "videasy");
      } else {
        fetch("/api/source-prefs")
          .then(r => r.json())
          .then(data => {
            if (data.enabled && Array.isArray(data.enabled) && data.enabled.length > 0) {
              setEnabled(data.enabled);
            } else {
              setEnabled(SOURCES.map((s) => s.id));
            }
            if (data.defaultSource && SOURCES.some((s) => s.id === data.defaultSource)) {
              setDefaultSource(data.defaultSource);
            } else {
              setDefaultSource("videasy");
            }
          })
          .catch(() => {
            setEnabled(SOURCES.map((s) => s.id));
            setDefaultSource("videasy");
          });
      }

      fetch("/api/ai-settings")
        .then(r => r.json())
        .then(data => {
          if (data) setAiSettings({ apiKey: data.apiKey || "", model: data.model || "openai/gpt-oss-120b:free" });
          apiKeyDirtyRef.current = false;
        })
        .catch(() => {});

      Promise.all([
        fetch("/api/ratings").then(r => r.json()),
        fetch("/api/watchlist").then(r => r.json())
      ])
        .then(([ratingsData, watchlistData]) => {
          const fullPrompt = buildRecommendationPrompt(ratingsData, watchlistData);
          setAiPayload(fullPrompt);
          setLogTokens(Math.ceil(fullPrompt.length / 4));
        })
        .catch(() => {});

      fetch("https://openrouter.ai/api/v1/models")
        .then(r => r.json())
        .then(res => {
          if (res.data) {
            const freeLarge = res.data
              .filter((m: any) => m.id.endsWith(":free") && m.context_length >= 100000)
              .map((m: any) => ({
                id: m.id,
                name: m.name.replace(/ \(free\)/i, ''),
                context: `${Math.round(m.context_length / 1000)}k Context`
              }));
            if (freeLarge.length > 0) setAiModels(freeLarge);
          }
        })
        .catch(() => {});

      if (username === "abhi") {
        fetch("/api/admin/stats")
          .then(r => r.json())
          .then(data => setAdminStats(data))
          .catch(() => {});
      }
    }
  }, [isOpen, username]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (selectRef.current && !selectRef.current.contains(e.target as Node)) setSelectOpen(false);
      if (modelSelectRef.current && !modelSelectRef.current.contains(e.target as Node)) setModelSelectOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const persistAiSettings = (newSettings: typeof aiSettings) => {
    fetch("/api/ai-settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newSettings)
    }).catch(() => {});
  };

  const enabledOptions = SOURCES.filter((s) => enabled.includes(s.id));
  const defaultOption = enabledOptions.find((s) => s.id === defaultSource) || enabledOptions[0];

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-300 ${
        isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
      }`}
    >
      <div
        className={`absolute inset-0 modal-backdrop bg-black/40 backdrop-blur-xl ${!isOpen ? "opacity-0" : ""}`}
        onClick={onClose}
      />
      <div
        className={`modal-panel w-full max-w-lg max-h-[80vh] flex flex-col p-6 overflow-y-auto no-scrollbar bg-[#090b14]/70 backdrop-blur-2xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.6)] rounded-2xl relative z-10 ${
          !isOpen ? "opacity-0 translate-y-6 scale-[0.97]" : ""
        }`}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-sm font-medium tracking-[0.15em] uppercase text-white/80">Settings</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full border border-white/10 bg-white/[0.02] hover:bg-white/[0.08] hover:border-white/20 flex items-center justify-center text-white/60 hover:text-white transition-all active:scale-95 duration-200 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-col gap-6">
          {/* Admin Section */}
          {username === "abhi" && adminStats && (
            <div className="flex flex-col gap-3 pb-2">
              <h3 className="text-[10px] font-semibold tracking-[0.28em] uppercase text-slate-400">Admin</h3>
              <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                <span className="text-xs text-white/50">Total Users</span>
                <span className="text-xs font-medium text-white/80">{adminStats.userCount}</span>
              </div>
              <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                <span className="text-xs text-white/50">Total Ratings</span>
                <span className="text-xs font-medium text-white/80">{adminStats.ratingCount}</span>
              </div>
              <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                <span className="text-xs text-white/50">Watchlist Entries</span>
                <span className="text-xs font-medium text-white/80">{adminStats.watchlistCount}</span>
              </div>
            </div>
          )}

          {/* Source Toggles */}
          <div className="flex flex-col gap-3">
            <h3 className="text-[10px] font-semibold tracking-[0.28em] uppercase text-slate-400">Sources</h3>
            <div className="flex flex-col gap-1.5">
              {SOURCES.map((source) => {
                const isOn = enabled.includes(source.id);
                return (
                  <div
                    key={source.id}
                    className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.05] cursor-pointer hover:bg-white/[0.04] transition-colors"
                    onClick={() => toggleSource(source.id)}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-white/70">{source.name}</span>
                      {source.supports.progress && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.06] text-white/30 tracking-wider uppercase">Progress</span>
                      )}
                    </div>
                    <span className="text-[10px] font-medium tracking-[0.15em] uppercase min-w-[32px] text-right">
                      {isOn ? <span className="text-white/60">On</span> : <span className="text-white/30">Off</span>}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Default Source */}
          <div className="flex flex-col gap-3 pt-4 border-t border-white/[0.05]">
            <h3 className="text-[10px] font-semibold tracking-[0.28em] uppercase text-slate-400">Default Source</h3>
            <div ref={selectRef} className="relative">
              <div
                onClick={() => setSelectOpen(!selectOpen)}
                className="flex items-center justify-between bg-white/[0.02] border border-white/[0.05] hover:border-white/10 rounded-xl px-3 py-2.5 text-xs text-white/80 cursor-pointer transition-all"
              >
                <span>{defaultOption?.name || "Select..."}</span>
                <ChevronDown className={`w-3.5 h-3.5 text-white/40 transition-transform ${selectOpen ? "rotate-180" : ""}`} />
              </div>
              {selectOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-[#0b0c10] border border-white/10 rounded-xl overflow-hidden z-[100] shadow-2xl">
                  {enabledOptions.map((s) => (
                    <div
                      key={s.id}
                      onClick={() => setNewDefault(s.id)}
                      className={`px-3 py-2 text-xs cursor-pointer transition-colors ${s.id === defaultSource ? "bg-white/10 text-white" : "text-white/60 hover:bg-white/5 hover:text-white/90"}`}
                    >
                      {s.name}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="text-[9px] text-slate-600 tracking-[0.15em] uppercase text-center pt-1">
              Continue Watching items use their saved source regardless
            </div>
          </div>

          {/* AI Settings */}
          <div className="flex flex-col gap-3 pt-4 border-t border-white/[0.05]">
            <div className="flex flex-col gap-1">
              <h3 className="text-[10px] font-semibold tracking-[0.28em] uppercase text-slate-400 flex items-center justify-between">
                <span>AI Configuration</span>
                <div className="flex items-center gap-3">
                  {logTokens !== null && <span className="text-[9px] text-white/30 tracking-widest normal-case">Log size: ~{logTokens.toLocaleString()} tokens</span>}
                  {aiPayload && (
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(aiPayload);
                        setCopiedPayload(true);
                        setTimeout(() => setCopiedPayload(false), 2000);
                      }}
                      className="text-[9px] px-2 py-0.5 rounded border border-white/10 bg-white/[0.03] hover:bg-white/[0.08] text-white/60 hover:text-white transition-colors"
                    >
                      {copiedPayload ? "Copied!" : "Copy Payload"}
                    </button>
                  )}
                </div>
              </h3>
              <div className="text-[9px] text-slate-500 tracking-[0.15em] uppercase">
                Auto-generates every 2 days
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[9px] text-slate-500 uppercase tracking-widest pl-1">OpenRouter API Key</label>
              <input
                type="password"
                placeholder="sk-or-v1-..."
                value={aiSettings.apiKey}
                onChange={(e) => {
                  setAiSettings(prev => ({ ...prev, apiKey: e.target.value }));
                  apiKeyDirtyRef.current = true;
                }}
                onBlur={() => {
                  if (apiKeyDirtyRef.current) {
                    persistAiSettings(aiSettingsRef.current);
                    apiKeyDirtyRef.current = false;
                  }
                }}
                className="w-full bg-white/[0.02] border border-white/[0.05] focus:border-white/20 rounded-xl px-3 py-2.5 text-xs text-white/80 placeholder:text-white/20 outline-none transition-all"
              />
            </div>

            <div className="flex flex-col gap-1.5 relative" ref={modelSelectRef}>
              <label className="text-[9px] text-slate-500 uppercase tracking-widest pl-1">Model Selection</label>
              <div
                onClick={() => setModelSelectOpen(!modelSelectOpen)}
                className="flex items-center justify-between bg-white/[0.02] border border-white/[0.05] hover:border-white/10 rounded-xl px-3 py-2.5 text-xs text-white/80 cursor-pointer transition-all"
              >
                <span>{aiModels.find(m => m.id === aiSettings.model)?.name || aiSettings.model || "Select Model"}</span>
                <ChevronDown className={`w-3.5 h-3.5 text-white/40 transition-transform ${modelSelectOpen ? "rotate-180" : ""}`} />
              </div>
              {modelSelectOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-[#0b0c10] border border-white/10 rounded-xl max-h-60 overflow-y-auto no-scrollbar z-[100] shadow-2xl">
                  {aiModels.map((m) => (
                    <div
                      key={m.id}
                      onClick={() => {
                        const newSettings = { ...aiSettings, model: m.id };
                        setAiSettings(newSettings);
                        persistAiSettings(newSettings);
                        setModelSelectOpen(false);
                      }}
                      className={`flex items-center justify-between px-3 py-2 text-xs cursor-pointer transition-colors ${m.id === aiSettings.model ? "bg-white/10 text-white" : "text-white/60 hover:bg-white/5 hover:text-white/90"}`}
                    >
                      <span>{m.name}</span>
                      <span className="text-[9px] text-white/30 uppercase tracking-widest">{m.context}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
