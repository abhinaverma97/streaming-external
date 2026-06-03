"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
    const [mode, setMode] = useState<"login" | "register">("login");
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        if (!username.trim() || !password.trim()) {
            setError("Please fill in all fields");
            return;
        }
        setLoading(true);
        try {
            const res = await fetch(`/api/auth/${mode}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username: username.trim(), password })
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.error || "Something went wrong");
                setLoading(false);
                return;
            }
            router.push("/");
        } catch {
            setError("Network error");
            setLoading(false);
        }
    };

    return (
        <div className="h-screen flex items-center justify-center bg-black">
            <div className="w-full max-w-sm mx-auto px-6">
                <div className="mb-8 text-center">
                    <h1 className="text-xl font-light tracking-[0.3em] text-white/90 uppercase">Bitcine</h1>
                    <p className="text-[11px] text-white/30 tracking-wider mt-2 font-light">
                        {mode === "login" ? "Sign in to continue" : "Create a new account"}
                    </p>
                </div>

                {/* Tab toggle */}
                <div className="flex items-center justify-center gap-6 mb-8">
                    <button
                        onClick={() => { setMode("login"); setError(""); }}
                        className={`text-[11px] uppercase tracking-[0.25em] pb-1 transition-colors ${mode === "login" ? "text-white border-b border-white" : "text-white/30 hover:text-white/60"}`}
                    >
                        Sign In
                    </button>
                    <button
                        onClick={() => { setMode("register"); setError(""); }}
                        className={`text-[11px] uppercase tracking-[0.25em] pb-1 transition-colors ${mode === "register" ? "text-white border-b border-white" : "text-white/30 hover:text-white/60"}`}
                    >
                        Register
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <input
                        type="text"
                        placeholder="Username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.08] text-sm text-white/90 placeholder-white/30 focus:outline-none focus:border-white/20 transition-colors"
                        autoFocus
                        autoComplete="username"
                    />
                    <input
                        type="password"
                        placeholder="Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.08] text-sm text-white/90 placeholder-white/30 focus:outline-none focus:border-white/20 transition-colors"
                        autoComplete={mode === "login" ? "current-password" : "new-password"}
                    />
                    {error && (
                        <p className="text-[11px] text-red-400/80 text-center">{error}</p>
                    )}
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full mt-1 py-3 rounded-xl bg-white hover:bg-slate-200 text-black text-sm font-semibold tracking-wide transition-all active:scale-[0.98] disabled:opacity-50"
                    >
                        {loading ? (
                            <span className="flex items-center justify-center gap-2">
                                <span className="w-3.5 h-3.5 rounded-full border border-black/30 border-t-black/80 animate-spin" />
                                {mode === "login" ? "Signing in..." : "Creating..."}
                            </span>
                        ) : (
                            <>{mode === "login" ? "Sign In" : "Create Account"}</>
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
}
