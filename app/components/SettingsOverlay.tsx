"use client";

import { useState, useEffect, useRef } from "react";
import { X, ChevronDown, LogOut } from "lucide-react";
import { SOURCES, getSource } from "../lib/sources-config";
import { useAuth } from "./AuthProvider";

interface SettingsOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onSourcesChange: (enabled: string[], defaultSource: string) => void;
}

export default function SettingsOverlay({ isOpen, onClose, onSourcesChange }: SettingsOverlayProps) {
  const { user, logout } = useAuth();
  const [enabled, setEnabled] = useState<string[]>([]);
  const [defaultSource, setDefaultSource] = useState("videasy");
  const [selectOpen, setSelectOpen] = useState(false);
  const selectRef = useRef<HTMLDivElement>(null);
  const [adminUsers, setAdminUsers] = useState<{ username: string; createdAt: number; lastActive: number | null }[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [activeUsers, setActiveUsers] = useState(0);
  const [adminLoading, setAdminLoading] = useState(false);

  const [aiSettings, setAiSettings] = useState({ apiKey: "", model: "openai/gpt-oss-120b:free" });
  const [logTokens, setLogTokens] = useState<number | null>(null);
  const [aiPayload, setAiPayload] = useState<string>("");
  const [copiedPayload, setCopiedPayload] = useState(false);
  const [modelSelectOpen, setModelSelectOpen] = useState(false);
  const modelSelectRef = useRef<HTMLDivElement>(null);
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

  const loadAdminData = async () => {
    setAdminLoading(true);
    try {
      const res = await fetch("/api/auth/users");
      if (!res.ok) {
        console.error("Admin fetch failed", res.status);
        return;
      }
      const data = await res.json();
      if (data?.users) setAdminUsers(data.users);
      setTotalUsers(data.totalUsers ?? data.users?.length ?? 0);
      setActiveUsers(data.activeUsers ?? 0);
    } catch (e) {
      console.error("Admin fetch error:", e);
    }
    setAdminLoading(false);
  };

  useEffect(() => {
    if (isOpen) {
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

      fetch("/api/ai-settings")
        .then(r => r.json())
        .then(data => {
            if (data) setAiSettings({ apiKey: data.apiKey || "", model: data.model || "openai/gpt-oss-120b:free" });
        })
        .catch(() => {});

      Promise.all([
        fetch("/api/ratings").then(r => r.json()),
        fetch("/api/watchlist").then(r => r.json())
      ])
        .then(([ratingsData, watchlistData]) => {
            const entries = Object.entries(ratingsData).filter(([, v]: any) => v && v.movieDetails);
            const formatted = entries.map(([tmdbId, item]: any, i) => {
                const d = item.movieDetails;
                const title = d.title || d.name || "Unknown";
                const year = (d.release_date || d.first_air_date || "").slice(0, 4) || "Unknown";
                const mediaType = tmdbId.startsWith("tv-") ? "TV Show" : "Movie";
                const userRating = item.rating ?? "?";
                const tmdbRating = d.vote_average ?? "N/A";
                let director = "Unknown";
                if (d.director) director = d.director;
                else if (d.credits?.crew) {
                    const dir = d.credits.crew.find((c: any) => c.job === "Director");
                    if (dir) director = dir.name;
                }
                const synopsis = d.overview || "N/A";
                const thoughts = item.thoughts ? `\n   User Thoughts: ${item.thoughts}` : "";
                return `${i + 1}. "${title}" (${year}) - ${mediaType}\n   User Rating: ${userRating}/5${thoughts}\n   TMDB Rating: ${tmdbRating}/10\n   Director: ${director}\n   Synopsis: ${synopsis}`;
            }).join("\n\n");
            
            const formattedWatchlist = (watchlistData || []).map((w: any) => `- "${w.movieDetails?.title || w.movieDetails?.name || "Unknown"}" (${(w.movieDetails?.release_date || w.movieDetails?.first_air_date || "").slice(0, 4) || "Unknown"}) - ${w.mediaType}`).join("\n");

            const fullPrompt = `You are a movie and TV show recommendation engine.\n\nAnalyze this user's complete set of rated content as a whole. Identify patterns in\ngenres, themes, directors, tone, and era preferences. Then recommend movies and TV\nshows the user would likely enjoy.\n\nUSER'S RATED CONTENT:\n${formatted || "None"}\n\nUSER'S WATCHLIST:\n${formattedWatchlist || "None"}\n\nBased on ALL items above, return a JSON object with:\n\n{\n  "recommendedMovies": [\n    { "title": "Inception", "year": 2010, "reason": "You enjoy Christopher Nolan's complex storytelling" }\n  ],\n  "recommendedTvShows": [\n    { "title": "Better Call Saul", "year": 2015, "reason": "You enjoy Vince Gilligan's character-driven crime dramas" }\n  ]\n}\n\nIMPORTANT:\n- The "year" field must be the release year of the recommended title (used to look it up on TMDB)\n- Recommend AT LEAST 18 movies and 18 TV shows.\n- DO NOT recommend anything already in the user's rated content list OR their watchlist above.\n- Provide a brief 1-sentence reason for each recommendation based on their ratings.\n- ONLY output the raw JSON object. No markdown, no introduction, no codeblocks.`;
            
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

      if (user === "abhi") {
        setAdminLoading(true);
        loadAdminData();
      }
    }
  }, [isOpen, user]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (selectRef.current && !selectRef.current.contains(e.target as Node)) setSelectOpen(false);
      if (modelSelectRef.current && !modelSelectRef.current.contains(e.target as Node)) setModelSelectOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const saveAiSettings = (newSettings: typeof aiSettings) => {
    setAiSettings(newSettings);
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
                
                <div className="flex flex-col gap-1.5">
                  <label className="text-[9px] text-slate-500 uppercase tracking-widest pl-1">OpenRouter API Key</label>
                  <input
                    type="password"
                    placeholder="sk-or-v1-..."
                    value={aiSettings.apiKey}
                    onChange={(e) => saveAiSettings({ ...aiSettings, apiKey: e.target.value })}
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
                            saveAiSettings({ ...aiSettings, model: m.id });
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

              {/* Account */}
              <div className="flex flex-col gap-3 pt-4 border-t border-white/[0.05]">
                <h3 className="text-[10px] font-semibold tracking-[0.28em] uppercase text-slate-400">Account</h3>
                <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                  <span className="text-xs text-white/70">{user}</span>
                </div>
                <button
                  onClick={async () => { onClose(); await logout(); }}
                  className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:bg-red-500/10 hover:border-red-500/20 text-white/50 hover:text-red-400 text-xs transition-all active:scale-[0.98]"
                >
                  <LogOut className="w-3.5 h-3.5" /> Sign Out
                </button>
              </div>

              {/* Admin */}
              {user === "abhi" && (
                <div className="flex flex-col gap-3 pt-4 border-t border-white/[0.05]">
                  <h3 className="text-[10px] font-semibold tracking-[0.28em] uppercase text-slate-400">Admin</h3>

                  {/* Stats */}
                  <div className="flex gap-3">
                    <div className="flex-1 px-3 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.05] text-center">
                      <div className="text-[18px] font-bold text-white/80">{totalUsers}</div>
                      <div className="text-[9px] text-white/30 tracking-wider uppercase mt-0.5">Total Users</div>
                    </div>
                    <div className="flex-1 px-3 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.05] text-center">
                      <div className="text-[18px] font-bold text-green-400">{activeUsers}</div>
                      <div className="text-[9px] text-white/30 tracking-wider uppercase mt-0.5">Active (24h)</div>
                    </div>
                  </div>

                  {/* User List */}
                  <div className="flex flex-col gap-1.5">
                    {adminLoading ? (
                      <div className="text-[10px] text-white/30 text-center py-3">Loading...</div>
                    ) : adminUsers.length === 0 ? (
                      <div className="text-[10px] text-white/30 text-center py-3">No users</div>
                    ) : (
                      adminUsers.map((u) => {
                        const isActive = u.lastActive && u.lastActive > Date.now() - 86400000;
                        return (
                          <div
                            key={u.username}
                            className="flex items-center justify-between px-3 py-2 rounded-xl bg-white/[0.02] border border-white/[0.05]"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isActive ? "bg-green-400" : "bg-white/20"}`} />
                              <span className="text-xs text-white/70 truncate">{u.username}</span>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <span className="text-[10px] text-white/30">{new Date(u.createdAt).toLocaleDateString()}</span>
                              {u.username !== "abhi" && (
                                <button
                                  onClick={async () => {
                                    if (!confirm(`Delete user "${u.username}"? This cannot be undone.`)) return;
                                    try {
                                      const res = await fetch(`/api/auth/users/${u.username}`, { method: "DELETE" });
                                      const text = await res.json().catch(() => ({}));
                                      if (res.ok) {
                                        loadAdminData();
                                      } else {
                                        alert(text.error || "Delete failed");
                                      }
                                    } catch (e) {
                                      console.error("Delete error:", e);
                                      alert("Delete failed — check console");
                                    }
                                  }}
                                  className="px-2 py-1 rounded-lg bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 text-red-400 text-[10px] font-medium transition-all active:scale-95 cursor-pointer"
                                >
                                  Delete
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
  );
}
