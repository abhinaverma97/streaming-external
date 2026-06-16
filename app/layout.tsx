import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import { PageTransition } from "./components/PageTransition";

import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "spicy",
  description: "A premium streaming catalog with personalized AI recommendations.",
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full scroll-smooth bg-black" data-scroll-behavior="smooth">
      <head>
        <meta name="color-scheme" content="dark" />
        <link rel="icon" href="/nob.ico" sizes="any" />
        <link rel="icon" href="/nob.png" type="image/png" sizes="192x192" />
        <link rel="preconnect" href="https://image.tmdb.org" />
      </head>
      <body
        className={`${outfit.className} min-h-full bg-black text-slate-100 antialiased overflow-x-hidden selection:bg-white/20 selection:text-white`}
      >
        {/* Critical inline CSS: guarantees black bg before external stylesheet loads (fixes Firefox FOUC) */}
        <style dangerouslySetInnerHTML={{ __html: `html,body{background:#000;color:#f8fafc}` }} />
        <PageTransition>{children}</PageTransition>
        {process.env.NODE_ENV === "production" ? (
          <script
            dangerouslySetInnerHTML={{
              __html: `
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js");
  });
}
`,
            }}
          />
        ) : (
          <script
            dangerouslySetInnerHTML={{
              __html: `
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (let r of registrations) {
      r.unregister().then(() => console.log("[Dev] Unregistered service worker"));
    }
  });
}
if ("caches" in window) {
  caches.keys().then((keys) => {
    for (let key of keys) {
      caches.delete(key).then(() => console.log("[Dev] Cleared cache:", key));
    }
  });
}
`,
            }}
          />
        )}
      </body>
    </html>
  );
}
