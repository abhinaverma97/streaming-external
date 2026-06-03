"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";

type AuthContextType = {
    user: string | null;
    logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({ user: null, logout: async () => {} });

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        fetch("/api/auth/me")
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => {
                setUser(data?.username || null);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, []);

    const logout = useCallback(async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        setUser(null);
        router.replace("/login");
    }, [router]);

    if (pathname === "/login") {
        return <>{children}</>;
    }

    if (loading) {
        return (
            <div className="h-screen flex items-center justify-center bg-black">
                <div className="w-5 h-5 rounded-full border border-white/20 border-t-white/80 animate-spin" />
            </div>
        );
    }

    if (!user) {
        router.replace("/login");
        return null;
    }

    return <AuthContext.Provider value={{ user, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    return useContext(AuthContext);
}
