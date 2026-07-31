"use client";

import { useEffect, useState } from "react";

const EVENT = "gameday:toast";

export function showSuccessToast(message: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { message } }));
}

export function ToastViewport() {
  const [toast, setToast] = useState<{ id: number; message: string } | null>(null);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const receive = (event: Event) => {
      const message = (event as CustomEvent<{ message?: string }>).detail?.message;
      if (!message) return;
      if (timer) clearTimeout(timer);
      setToast({ id: Date.now(), message });
      timer = setTimeout(() => setToast(null), 5000);
    };
    window.addEventListener(EVENT, receive);
    return () => { window.removeEventListener(EVENT, receive); if (timer) clearTimeout(timer); };
  }, []);
  if (!toast) return null;
  return (
    <div className="pointer-events-none fixed inset-x-4 top-4 z-[100] flex justify-center sm:inset-x-auto sm:right-5 sm:top-5" aria-live="polite" aria-atomic="true">
      <div key={toast.id} role="status" className="pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-2xl border border-ok-line bg-white px-4 py-3 text-sm text-ink shadow-[0_18px_48px_rgba(14,18,48,0.22)]">
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ok-soft font-bold text-ok" aria-hidden="true">✓</span>
        <div className="min-w-0 flex-1"><strong className="block text-ok">Action completed</strong><span className="text-ink-soft">{toast.message}</span></div>
        <button type="button" onClick={() => setToast(null)} className="pointer-events-auto rounded px-1 text-lg leading-5 text-ink-muted hover:text-ink" aria-label="Dismiss notification">×</button>
      </div>
    </div>
  );
}
