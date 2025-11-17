"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";

const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || "";

// Add a proper type for gtag
declare global {
  interface Window {
    gtag?: (
      command: "config" | "js" | string,
      targetId: string,
      config?: Record<string, unknown>
    ) => void;
  }
}

export default function Analytics() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!GA_ID || typeof window === "undefined" || !window.gtag) return;

    const url =
      pathname + (searchParams?.toString() ? `?${searchParams}` : "");

    window.gtag("config", GA_ID, { page_path: url });
  }, [pathname, searchParams]);

  return null;
}