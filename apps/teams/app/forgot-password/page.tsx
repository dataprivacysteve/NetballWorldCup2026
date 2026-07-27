"use client";

import { useState } from "react";
import Link from "next/link";
import { api } from "../lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [devToken, setDevToken] = useState<string | null>(null);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(null);
    try { const result = await api.requestPasswordReset(email); setSent(true); setDevToken(result.devResetToken ?? null); }
    catch (reason) { setError(reason); }
    finally { setBusy(false); }
  }
  return <main className="grid min-h-screen place-items-center bg-bg px-5"><div className="w-full max-w-md rounded-2xl border border-line bg-white p-7 shadow-[0_24px_60px_rgba(14,18,48,0.1)]"><p className="font-mono text-[0.64rem] font-bold uppercase tracking-[0.13em] text-navy">Team account recovery</p><h1 className="mt-1 font-display text-3xl font-bold text-ink">Reset your password</h1>{sent ? <div role="status" className="mt-5 rounded-xl border border-ok-line bg-ok-soft p-4 text-sm text-ink-soft"><strong className="text-ok">Check your email.</strong> If the account exists, a 30-minute reset link has been sent.{devToken && <Link className="mt-3 block font-semibold text-navy underline" href={`/reset-password?token=${encodeURIComponent(devToken)}`}>Open local development reset link</Link>}</div> : <form className="mt-5 space-y-4" onSubmit={submit}>{error !== null && <div role="alert" className="rounded-lg border border-bad-line bg-bad-soft p-3 text-sm text-bad">{(error as Error).message}</div>}<label><span className="mb-1 block font-mono text-[0.64rem] font-bold uppercase tracking-[0.08em] text-ink-muted">Login email</span><input className="enterprise-input w-full rounded-lg border border-line-strong px-3 py-2 text-sm" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email"/></label><button className="enterprise-button min-h-10 w-full rounded-lg bg-navy px-4 text-sm font-bold text-white" disabled={busy}>{busy ? "Requesting…" : "Send reset link"}</button></form>}<Link href="/" className="mt-5 block text-center text-xs font-semibold text-navy hover:underline">Return to sign in</Link></div></main>;
}
