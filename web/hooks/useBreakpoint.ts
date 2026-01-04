"use client";

import { useState, useEffect, useCallback } from "react";

type Breakpoint = "sm" | "md" | "lg" | "xl" | "2xl";

interface BreakpointState {
  breakpoint: Breakpoint;
  isMobile: boolean; // < 768px (sm and below)
  isTablet: boolean; // 768px - 1023px (md to lg)
  isDesktop: boolean; // >= 1024px (lg and above)
  width: number;
}

const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  "2xl": 1536,
} as const;

function getBreakpoint(width: number): Breakpoint {
  if (width < BREAKPOINTS.sm) return "sm";
  if (width < BREAKPOINTS.md) return "md";
  if (width < BREAKPOINTS.lg) return "lg";
  if (width < BREAKPOINTS.xl) return "xl";
  return "2xl";
}

export function useBreakpoint(): BreakpointState {
  const [state, setState] = useState<BreakpointState>(() => {
    // SSR fallback - assume desktop
    if (typeof window === "undefined") {
      return {
        breakpoint: "xl",
        isMobile: false,
        isTablet: false,
        isDesktop: true,
        width: 1280,
      };
    }
    const width = window.innerWidth;
    return {
      breakpoint: getBreakpoint(width),
      isMobile: width < BREAKPOINTS.md,
      isTablet: width >= BREAKPOINTS.md && width < BREAKPOINTS.lg,
      isDesktop: width >= BREAKPOINTS.lg,
      width,
    };
  });

  const handleResize = useCallback(() => {
    const width = window.innerWidth;
    setState({
      breakpoint: getBreakpoint(width),
      isMobile: width < BREAKPOINTS.md,
      isTablet: width >= BREAKPOINTS.md && width < BREAKPOINTS.lg,
      isDesktop: width >= BREAKPOINTS.lg,
      width,
    });
  }, []);

  useEffect(() => {
    // Initial check on mount
    handleResize();

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [handleResize]);

  return state;
}

export { BREAKPOINTS };
