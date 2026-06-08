"use client";

import { ReactNode } from "react";
import { usePathname } from "next/navigation";

export default function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div key={pathname} style={{ animation: "pageFadeIn 0.3s cubic-bezier(0.25, 0.1, 0.25, 1)" }}>
      {children}
      <style dangerouslySetInnerHTML={{
        __html: `
        @keyframes pageFadeIn {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}} />
    </div>
  );
}
