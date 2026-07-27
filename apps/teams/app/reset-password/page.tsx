"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api } from "../lib/api";

export default function ResetPasswordPage() {
  return <Suspense fallback={<main className="grid min-h-screen place-items-center bg-bg"><p className="text-sm text-ink-muted">Preparing secure reset…</p></main>}><ResetPasswordForm /></Suspense>;
}

function ResetPasswordForm() {
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<unknown>(null);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError(null);
    if (password !== confirm) { setError(new Error("Passwords do not match.")); return; }
    setBusy(true);
    try { await api.completePasswordReset(token, password); setDone(true); }
    catch (reason) { setError(reason); }
    finally { setBusy(false); }
  }
  return <main className="grid min-h-screen place-items-center bg-bg px-5"><div className="w-full max-w-md rounded-2xl border border-line bg-white p-7 shadow-[0_24px_60px_rgba(14,18,48,0.1)]"><p className="font-mono text-[0.64rem] font-bold uppercase tracking-[0.13em] text-navy">Secure account recovery</p><h1 className="mt-1 font-display text-3xl font-bold text-ink">Choose a new password</h1>{done ? <div role="status" className="mt-5 rounded-xl border border-ok-line bg-ok-soft p-4 text-sm text-ink-soft"><strong className="text-ok">Password updated.</strong> Existing sessions have been revoked.<Link href="/" className="mt-3 block font-semibold text-navy underline">Continue to sign in</Link></div> : <form className="mt-5 space-y-4" onSubmit={submit}>{error !== null && <div role="alert" className="rounded-lg border border-bad-line bg-bad-soft p-3 text-sm text-bad">{(error as Error).message}</div>}<label><span className="mb-1 block font-mono text-[0.64rem] font-bold uppercase tracking-[0.08em] text-ink-muted">New password</span><input className="enterprise-input w-full rounded-lg border border-line-strong px-3 py-2 text-sm" type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={12} required autoComplete="new-password"/></label><label><span className="mb-1 block font-mono text-[0.64rem] font-bold uppercase tracking-[0.08em] text-ink-muted">Confirm password</span><input className="enterprise-input w-full rounded-lg border border-line-strong px-3 py-2 text-sm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} minLength={12} required autoComplete="new-password"/></label><button className="enterprise-button min-h-10 w-full rounded-lg bg-navy px-4 text-sm font-bold text-white disabled:opacity-50" disabled={busy || !token}>{busy ? "Updating…" : "Update password"}</button></form>}</div></main>;
}
