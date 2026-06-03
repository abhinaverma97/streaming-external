import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import { AuthProvider } from "./components/AuthProvider";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "spicy",
  description: "Dynamic TMDB Metadata, WebTorrent Streaming & HLS Transcoding Backend Console.",
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full scroll-smooth" data-scroll-behavior="smooth">
      <head>
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
      </head>
      <body
        className={`${outfit.className} min-h-full bg-black text-slate-100 antialiased overflow-x-hidden selection:bg-white/20 selection:text-white`}
      >
        <AuthProvider>{children}</AuthProvider>
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
      </body>
    </html>
  );
}
