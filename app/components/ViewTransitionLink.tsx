"use client";

import Link, { LinkProps } from "next/link";
import { useRouter } from "next/navigation";
import React from "react";

interface ViewTransitionLinkProps extends LinkProps {
  children: React.ReactNode;
  className?: string;
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
}

export function ViewTransitionLink({
  href,
  children,
  className,
  onClick,
  ...props
}: ViewTransitionLinkProps) {
  const router = useRouter();

  const handleTransition = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (onClick) {
      onClick(e);
      if (e.defaultPrevented) return;
    }

    e.preventDefault();
    
    // If browser doesn't support view transitions or it's an external link, standard navigation
    if (
      !("startViewTransition" in document) ||
      typeof href !== "string" ||
      href.startsWith("http")
    ) {
      router.push(href.toString());
      return;
    }

    (document as any).startViewTransition(() => {
      router.push(href.toString());
    });
  };

  return (
    <Link href={href} className={className} onClick={handleTransition} {...props}>
      {children}
    </Link>
  );
}
