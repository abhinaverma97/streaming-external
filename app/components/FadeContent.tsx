"use client";

import { ReactNode } from "react";
import { motion } from "framer-motion";

interface FadeContentProps {
  children: ReactNode;
  delay?: number;
  duration?: number;
  className?: string;
}

export default function FadeContent({
  children,
  delay = 0,
  duration = 0.5,
  className = "",
}: FadeContentProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ type: "spring", stiffness: 200, damping: 20, delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
