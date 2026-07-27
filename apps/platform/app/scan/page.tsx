"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BrowserQRCodeReader } from "@zxing/browser";
import Link from "next/link";
import { api, type GateScanEvent, type Me, type ScanResult } from "../lib/api";
import {
  getOfflineBundle,
  getOfflineQueue,
  removeSyncedOfflineEvents,
  saveOfflineBundle,
  verifyOffline,
} from "../lib/offline-gate";

const inputCls =
  "enterprise-input w-full rounded-lg border border-line-strong bg-white px-3 py-2 text-sm text-ink placeholder:text-ink-faded focus:border-navy focus:outline-none focus:ring-2 focus:ring-gold/50";
const btnPrimary =
  "enterprise-button inline-flex items-center justify-center gap-2 rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-soft disabled:opacity-50";

function GateIcon({
  name,
  className = "h-5 w-5",
}: {
  name: "scan" | "check" | "close" | "shield";
  className?: string;
}) {
  const path =
    name === "scan" ? (
      <>
        <path d="M3 8V5a2 2 0 0 1 2-2h3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M8 21H5a2 2 0 0 1-2-2v-3M7 12h10" />
      </>
    ) : name === "check" ? (
      <path d="M20 6 9 17l-5-5" />
    ) : name === "close" ? (
      <path d="m6 6 12 12M18 6 6 18" />
    ) : (
      <>
        <path d="M12 22s8-3.5 8-10V5l-8-3-8 3v7c0 6.5 8 10 8 10z" />
        <path d="m9 12 2 2 4-4" />
      </>
    );
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {path}
    </svg>
  );
}

export default function ScanPage() {
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const refresh = useCallback(async () => setMe(await api.me()), []);
  useEffect(() => {
    let active = true;
    void api.me().then((session) => {
      if (active) setMe(session);
    });
    return () => {
      active = false;
    };
  }, []);

  if (me === undefined) return null;
  if (!me?.user || !me.user.isAdmin) return <GateSignIn onAuthed={refresh} />;
  return <Scanner />;
}

function GateSignIn({ onAuthed }: { onAuthed: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const me = await api.login(email, password);
      if (!me.user?.isAdmin) {
        setError("This sign-in is for accreditation staff.");
        return;
      }
      onAuthed();
    } catch {
      setError("Invalid email or password.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-5 py-10">
      <form
        onSubmit={submit}
        className="enterprise-panel w-full max-w-md space-y-5 p-6 shadow-[0_25px_60px_rgba(14,18,48,0.11)] sm:p-8"
      >
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-navy-tint text-navy">
          <GateIcon name="shield" />
        </span>
        <div>
          <p className="font-mono text-[0.64rem] font-bold uppercase tracking-[0.13em] text-navy">
            Secure venue access
          </p>
          <h1 className="mt-1 font-display text-3xl font-bold text-ink">
            Gate sign-in
          </h1>
          <p className="mt-2 text-sm leading-6 text-ink-soft">
            Authorised LOC credentials are required to verify accreditation
            badges.
          </p>
        </div>
        {error && (
          <p
            role="alert"
            className="rounded-xl border border-bad-line bg-bad-soft p-3 text-sm text-bad"
          >
            {error}
          </p>
        )}
        <label className="block">
          <span className="mb-1 block font-mono text-[0.66rem] font-bold uppercase tracking-[0.08em] text-ink-muted">
            Email
          </span>
          <input
            type="email"
            className={inputCls}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </label>
        <label className="block">
          <span className="mb-1 block font-mono text-[0.66rem] font-bold uppercase tracking-[0.08em] text-ink-muted">
            Password
          </span>
          <input
            type="password"
            className={inputCls}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        <button className={`${btnPrimary} w-full`} disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}

function Scanner() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [manual, setManual] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<GateScanEvent[]>([]);
  const [online, setOnline] = useState(true);
  const [mode, setMode] = useState<"online" | "offline">("online");
  const [bundleExpiresAt, setBundleExpiresAt] = useState<string | null>(null);
  const [queued, setQueued] = useState(0);
  const [syncing, setSyncing] = useState(false);

  const refreshOfflineStatus = useCallback(() => {
    setOnline(window.navigator.onLine);
    setBundleExpiresAt(getOfflineBundle()?.expiresAt ?? null);
    setQueued(getOfflineQueue().length);
  }, []);

  const syncOffline = useCallback(async () => {
    if (!window.navigator.onLine) {
      refreshOfflineStatus();
      return;
    }
    setSyncing(true);
    try {
      const pending = getOfflineQueue();
      if (pending.length) {
        const response = await api.syncOfflineScans(pending);
        removeSyncedOfflineEvents(
          response.outcomes
            .filter((outcome) => outcome.accepted)
            .map((outcome) => outcome.clientEventId),
        );
      }
      saveOfflineBundle(await api.offlineGateBundle());
    } finally {
      setSyncing(false);
      refreshOfflineStatus();
    }
  }, [refreshOfflineStatus]);

  const refreshHistory = useCallback(() => {
    void api
      .gateHistory()
      .then(setHistory)
      .catch(() => undefined);
  }, []);

  useEffect(() => refreshHistory(), [refreshHistory]);

  useEffect(() => {
    const initial = window.setTimeout(() => {
      refreshOfflineStatus();
      if (window.navigator.onLine) void syncOffline();
    }, 0);
    const status = () => {
      refreshOfflineStatus();
      if (window.navigator.onLine) void syncOffline();
    };
    window.addEventListener("online", status);
    window.addEventListener("offline", status);
    if ("serviceWorker" in window.navigator) {
      void window.navigator.serviceWorker.register("/sw.js");
    }
    return () => {
      window.clearTimeout(initial);
      window.removeEventListener("online", status);
      window.removeEventListener("offline", status);
    };
  }, [refreshOfflineStatus, syncOffline]);

  const stopCamera = useCallback(() => {
    controlsRef.current?.stop();
    controlsRef.current = null;
    setScanning(false);
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  const check = useCallback(
    async (token: string) => {
      stopCamera();
      setError(null);
      setPhoto(null);
      try {
        const r = await api.verifyScan(token.trim());
        setMode("online");
        setResult(r);
        refreshHistory();
        if (r.valid && r.person) {
          api
            .blobUrl(`/admin/players/${r.person.id}/photo/image`)
            .then(setPhoto)
            .catch(() => {});
        }
      } catch {
        const offline = await verifyOffline(token.trim());
        setMode("offline");
        setResult(offline.result);
        refreshOfflineStatus();
        if (offline.bundleExpired) {
          setError(offline.result.valid ? null : offline.result.reason);
        }
      }
    },
    [refreshHistory, refreshOfflineStatus, stopCamera],
  );

  async function startCamera() {
    setResult(null);
    setError(null);
    setScanning(true);
    try {
      const reader = new BrowserQRCodeReader();
      controlsRef.current = await reader.decodeFromVideoDevice(
        undefined,
        videoRef.current!,
        (res) => {
          if (res) check(res.getText());
        },
      );
    } catch {
      setScanning(false);
      setError("Camera unavailable — use the token field below.");
    }
  }

  function reset() {
    setResult(null);
    setPhoto(null);
    setManual("");
    setError(null);
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-xl px-5 py-8">
      <div className="mb-7 flex items-center justify-between">
        <div>
          <p className="font-mono text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-navy">
            Gate verification
          </p>
          <h1 className="mt-1 font-display text-3xl font-bold text-ink">
            Verify credential
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            Scan the badge QR or enter its secure token.
          </p>
        </div>
        <Link
          href="/"
          className="text-xs text-navy underline-offset-2 hover:underline"
        >
          ← Console
        </Link>
      </div>

      <section className="mb-5 rounded-xl border border-line bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-ink">
              {online ? "Gate connection online" : "Offline gate mode"}
            </p>
            <p className="mt-0.5 text-xs text-ink-muted">
              {bundleExpiresAt
                ? `Credential pack valid until ${new Date(bundleExpiresAt).toLocaleString()}`
                : "No offline credential pack installed"}
              {queued ? ` · ${queued} scan${queued === 1 ? "" : "s"} awaiting sync` : ""}
            </p>
          </div>
          <button
            type="button"
            disabled={!online || syncing}
            onClick={() => void syncOffline()}
            className="rounded-lg border border-line-strong px-3 py-2 text-xs font-semibold text-navy disabled:opacity-50"
          >
            {syncing ? "Synchronising…" : "Refresh offline pack"}
          </button>
        </div>
      </section>

      {result ? (
        <ResultCard result={result} photo={photo} mode={mode} onNext={reset} />
      ) : (
        <div className="space-y-4">
          <div className="relative overflow-hidden rounded-2xl border border-line bg-navy-deep shadow-[0_18px_45px_rgba(14,18,48,0.13)]">
            <video
              ref={videoRef}
              className="aspect-square w-full object-cover"
            />
            {!scanning && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-navy-deep text-white">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-gold-bright">
                  <GateIcon name="scan" className="h-7 w-7" />
                </span>
                <p className="mt-4 text-sm font-semibold">
                  Camera is ready to start
                </p>
                <p className="mt-1 text-xs text-white/55">
                  Position the credential inside the frame
                </p>
              </div>
            )}
          </div>
          {error && <p className="text-sm text-bad">{error}</p>}
          {!scanning ? (
            <button onClick={startCamera} className={`${btnPrimary} w-full`}>
              <GateIcon name="scan" className="h-4 w-4" /> Start camera
            </button>
          ) : (
            <button
              onClick={stopCamera}
              className="w-full rounded-lg border border-line-strong bg-white px-4 py-2 text-sm font-semibold text-ink-soft"
            >
              Stop camera
            </button>
          )}
          <div className="enterprise-panel p-5">
            <p className="mb-1 font-mono text-[0.66rem] font-semibold uppercase tracking-[0.08em] text-ink-muted">
              Or enter credential token
            </p>
            <textarea
              className={inputCls}
              rows={2}
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              placeholder="Paste the credential token"
            />
            <button
              onClick={() => manual.trim() && check(manual)}
              className={`${btnPrimary} mt-2 w-full`}
            >
              Verify
            </button>
          </div>
        </div>
      )}
      <section className="mt-7 overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-line bg-bg-soft px-4 py-3">
          <div>
            <h2 className="text-sm font-bold text-ink">Recent gate activity</h2>
            <p className="mt-0.5 text-xs text-ink-muted">
              The latest verified and rejected scan attempts.
            </p>
          </div>
          <button
            type="button"
            onClick={refreshHistory}
            className="text-xs font-semibold text-navy hover:underline"
          >
            Refresh
          </button>
        </div>
        {history.length === 0 ? (
          <p className="px-4 py-5 text-sm text-ink-muted">
            No gate scans recorded yet.
          </p>
        ) : (
          <div className="divide-y divide-line">
            {history.slice(0, 20).map((event) => (
              <div
                key={event.id}
                className="flex items-start justify-between gap-4 px-4 py-3 text-sm"
              >
                <div>
                  <p
                    className={
                      event.valid
                        ? "font-semibold text-ok"
                        : "font-semibold text-bad"
                    }
                  >
                    {event.valid ? "Valid credential" : "Rejected scan"}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-muted">
                    {event.reason ??
                      (event.credentialId
                        ? `Credential ${event.credentialId.slice(0, 8)}`
                        : "Token checked")}
                  </p>
                </div>
                <div className="shrink-0 text-right text-xs text-ink-muted">
                  <p>{new Date(event.createdAt).toLocaleString()}</p>
                  <p className="mt-0.5">{event.actorName}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function ResultCard({
  result,
  photo,
  onNext,
  mode,
}: {
  result: ScanResult;
  photo: string | null;
  onNext: () => void;
  mode: "online" | "offline";
}) {
  if (!result.valid) {
    return (
      <div
        role="alert"
        className="rounded-2xl border-2 border-bad bg-bad-soft p-7 text-center"
      >
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white text-bad shadow-sm">
          <GateIcon name="close" className="h-8 w-8" />
        </span>
        <div className="mt-4 font-display text-3xl font-extrabold text-bad">
          Credential invalid
        </div>
        <p className="mt-2 text-sm text-ink-soft">{result.reason}</p>
        <p className="mt-2 font-mono text-[0.65rem] uppercase tracking-wider text-ink-muted">
          {mode === "offline" ? "Offline decision · queued for reconciliation" : "Online decision"}
        </p>
        <button onClick={onNext} className={`${btnPrimary} mt-5`}>
          Scan next
        </button>
      </div>
    );
  }
  const p = result.person;
  return (
    <div
      role="status"
      className="rounded-2xl border-2 border-ok bg-ok-soft p-7 text-center"
    >
      <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white text-ok shadow-sm">
        <GateIcon name="check" className="h-8 w-8" />
      </span>
      <div className="mt-4 font-display text-3xl font-extrabold text-ok">
        Credential valid
      </div>
      <div className="mx-auto mt-4 h-28 w-24 overflow-hidden rounded-lg bg-bg-sand ring-1 ring-line">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt="" className="h-full w-full object-cover" />
        ) : null}
      </div>
      <div className="mt-3 font-display text-xl font-bold text-ink">
        {p ? `${p.firstName} ${p.lastName}` : "—"}
      </div>
      <div className="font-mono text-[0.7rem] uppercase tracking-[0.06em] text-ink-muted">
        {p?.category}
        {p?.role ? ` · ${p.role}` : ""}
      </div>
      <div className="mt-1 text-sm text-ink-soft">
        {result.delegation
          ? `${result.delegation.name} · ${result.delegation.countryCode}`
          : ""}
      </div>
      <p className="mt-2 font-mono text-[0.65rem] uppercase tracking-wider text-ink-muted">
        {mode === "offline" ? "Offline decision · queued for reconciliation" : "Online decision"}
      </p>
      <button onClick={onNext} className={`${btnPrimary} mt-5`}>
        Scan next
      </button>
    </div>
  );
}
