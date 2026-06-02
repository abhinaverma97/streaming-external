import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Bitcine - Premium Streaming Console",
  description: "Dynamic TMDB Metadata, WebTorrent Streaming & HLS Transcoding Backend Console.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full scroll-smooth" data-scroll-behavior="smooth">
      <body
        className={`${outfit.className} min-h-full bg-black text-slate-100 antialiased overflow-x-hidden selection:bg-white/20 selection:text-white`}
      >
        {children}
      </body>
    </html>
  );
}
