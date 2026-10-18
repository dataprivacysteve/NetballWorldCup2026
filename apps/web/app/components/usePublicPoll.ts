"use client";

import { useEffect, useRef, useState } from "react";

const API =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://api.netballamericas.test";

// One request at a time; keep the last good data on failure and pause hidden tabs.
export function usePublicPoll<T>(path: string, initial: T, intervalMs: number) {
  const [data, setData] = useState(initial);
  const [delayed, setDelayed] = useState(false);
  const previous = useRef(JSON.stringify(initial));

  useEffect(() => {
    let active = true;
    let failures = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let request: AbortController | null = null;
    const load = async () => {
      if (!active || document.hidden || request) return;
      clearTimeout(timer);
      const controller = new AbortController();
      request = controller;
      const timeout = setTimeout(() => controller.abort(), 10_000);
      try {
        const response = await fetch(`${API}${path}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Public updates unavailable");
        const next = (await response.json()) as T;
        if (!active) return;
        const serialized = JSON.stringify(next);
        if (serialized !== previous.current) {
          previous.current = serialized;
          setData(next);
        }
        failures = 0;
        setDelayed(false);
      } catch {
        if (active && ++failures >= 2) setDelayed(true);
      } finally {
        clearTimeout(timeout);
        request = null;
        if (active && !document.hidden)
          timer = setTimeout(
            () => void load(),
            Math.min(intervalMs * Math.max(1, failures), 30_000),
          );
      }
    };
    const resume = () => {
      clearTimeout(timer);
      if (!document.hidden) void load();
    };
    void load();
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("focus", resume);
    window.addEventListener("online", resume);
    return () => {
      active = false;
      clearTimeout(timer);
      request?.abort();
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("focus", resume);
      window.removeEventListener("online", resume);
    };
  }, [path, intervalMs]);

  return { data, delayed };
}
