"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BrowserQRCodeReader } from "@zxing/browser";
import { api, type Me, type ScanResult } from "../lib/api";

const inputCls =
  "w-full rounded-md border border-line-strong bg-white px-3 py-2 text-sm text-ink placeholder:text-ink-faded focus:border-navy focus:outline-none focus:ring-2 focus:ring-gold/50";
const btnPrimary =
  "rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white transition hover:bg-navy-soft disabled:opacity-50";

export default function ScanPage() {
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const refresh = useCallback(async () => setMe(await api.me()), []);
  useEffect(() => {
    refresh();
  }, [refresh]);

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
    <div className="flex min-h-screen items-center justify-center px-5">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4">
        <h1 className="font-display text-xl font-bold text-ink">
          Gate sign-in
        </h1>
        {error && <p className="text-sm text-bad">{error}</p>}
        <input
          type="email"
          className={inputCls}
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          className={inputCls}
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
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

  const stopCamera = useCallback(() => {
    controlsRef.current?.stop();
    controlsRef.current = null;
    setScanning(false);
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  const check = useCallback(async (token: string) => {
    stopCamera();
    setError(null);
    setPhoto(null);
    try {
      const r = await api.verifyScan(token.trim());
      setResult(r);
      if (r.valid && r.person) {
        api
          .blobUrl(`/admin/players/${r.person.id}/photo/image`)
          .then(setPhoto)
          .catch(() => {});
      }
    } catch {
      setError("Could not verify — check the gate connection.");
    }
  }, [stopCamera]);

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
    <main className="mx-auto min-h-screen w-full max-w-md px-5 py-8">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <p className="font-mono text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-navy">
            Gate verification
          </p>
          <h1 className="font-display text-2xl font-bold text-ink">Scan</h1>
        </div>
        <a href="/" className="text-xs text-navy underline-offset-2 hover:underline">
          ← Console
        </a>
      </div>

      {result ? (
        <ResultCard result={result} photo={photo} onNext={reset} />
      ) : (
        <div className="space-y-4">
          <div className="overflow-hidden rounded-2xl border border-line bg-black">
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video ref={videoRef} className="aspect-square w-full object-cover" />
          </div>
          {error && <p className="text-sm text-bad">{error}</p>}
          {!scanning ? (
            <button onClick={startCamera} className={`${btnPrimary} w-full`}>
              Start camera
            </button>
          ) : (
            <button
              onClick={stopCamera}
              className="w-full rounded-lg border border-line-strong bg-white px-4 py-2 text-sm font-semibold text-ink-soft"
            >
              Stop camera
            </button>
          )}
          <div className="rounded-2xl border border-line bg-white p-4">
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
    </main>
  );
}

function ResultCard({
  result,
  photo,
  onNext,
}: {
  result: ScanResult;
  photo: string | null;
  onNext: () => void;
}) {
  if (!result.valid) {
    return (
      <div className="rounded-2xl border-2 border-bad bg-[#FBE6E2] p-6 text-center">
        <div className="font-display text-4xl font-extrabold text-bad">
          ✗ INVALID
        </div>
        <p className="mt-2 text-sm text-ink-soft">{result.reason}</p>
        <button onClick={onNext} className={`${btnPrimary} mt-5`}>
          Scan next
        </button>
      </div>
    );
  }
  const p = result.person;
  return (
    <div className="rounded-2xl border-2 border-ok bg-[#E7F7EE] p-6 text-center">
      <div className="font-display text-4xl font-extrabold text-ok">✓ VALID</div>
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
      <button onClick={onNext} className={`${btnPrimary} mt-5`}>
        Scan next
      </button>
    </div>
  );
}
