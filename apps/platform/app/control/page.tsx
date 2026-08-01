"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  api,
  type EligibleCountry,
  type LaunchConfiguration,
  type LaunchConfigurationResponse,
  type Me,
} from "../lib/api";

const panel =
  "rounded-2xl border border-line bg-white shadow-[0_10px_30px_rgba(14,18,48,0.06)]";
const input =
  "enterprise-input w-full rounded-lg border border-line-strong bg-white px-3 py-2 text-sm text-ink focus:border-navy focus:outline-none focus:ring-2 focus:ring-gold/50";
const label =
  "mb-1 block font-mono text-[0.64rem] font-bold uppercase tracking-[0.09em] text-ink-muted";
const primary =
  "enterprise-button inline-flex min-h-10 items-center justify-center rounded-lg bg-navy px-4 text-sm font-bold text-white hover:bg-navy-deep disabled:cursor-not-allowed disabled:opacity-50";
const gold =
  "enterprise-button inline-flex min-h-10 items-center justify-center rounded-lg bg-gold px-4 text-sm font-bold text-navy-deep hover:bg-gold-bright disabled:cursor-not-allowed disabled:opacity-50";
const PUBLIC_SITE =
  process.env.NEXT_PUBLIC_PUBLIC_SITE_URL ?? "https://www.netballamericas.test";

const officialRoles = ["team_manager", "coach", "primary_care", "other"];
const personCategories = [
  "player",
  "official",
  "technical",
  "media",
  "broadcast",
];

function ErrorNotice({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <div
      role="alert"
      className="rounded-xl border border-bad-line bg-bad-soft p-4 text-sm text-bad"
    >
      <strong>Action required:</strong> {(error as Error).message}
    </div>
  );
}

function toLocal(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const pad = (number: number) => String(number).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function assetUrl(value: string | null) {
  if (!value) return null;
  return value.startsWith("http") ? value : `${PUBLIC_SITE}${value}`;
}

export default function ControlPage() {
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

  if (me === undefined)
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="font-mono text-xs uppercase tracking-[0.12em] text-ink-muted">
          Preparing SportsBB control plane…
        </p>
      </main>
    );
  if (!me?.user) return <ControlSignIn onAuthed={refresh} />;
  if (me.user.platformRole !== "sportsbb_admin") return <WrongAuthority />;
  return <ControlWorkspace me={me} onSignedOut={() => setMe(null)} />;
}

function ControlSignIn({ onAuthed }: { onAuthed: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.login(email, password);
      onAuthed();
    } catch (reason) {
      setError(reason);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="grid min-h-screen place-items-center bg-bg px-5 py-10">
      <form
        onSubmit={submit}
        className={`${panel} w-full max-w-md space-y-5 p-7`}
      >
        <div>
          <p className="font-mono text-[0.64rem] font-bold uppercase tracking-[0.14em] text-gold-deep">
            SportsBB authority
          </p>
          <h1 className="mt-1 font-display text-3xl font-bold text-ink">
            Tournament control plane
          </h1>
          <p className="mt-2 text-sm leading-6 text-ink-muted">
            Configure and publish the reusable GameDay tournament instance. LOC
            credentials cannot enter this area.
          </p>
        </div>
        <ErrorNotice error={error} />
        <label>
          <span className={label}>Email</span>
          <input
            className={input}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </label>
        <label>
          <span className={label}>Password</span>
          <input
            className={input}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </label>
        <button className={`${primary} w-full`} disabled={busy}>
          {busy ? "Signing in…" : "Enter control plane"}
        </button>
      </form>
    </main>
  );
}

function WrongAuthority() {
  return (
    <main className="flex min-h-screen items-center justify-center px-5">
      <div className={`${panel} max-w-md p-7 text-center`}>
        <h1 className="font-display text-2xl font-bold text-ink">
          SportsBB administrator only
        </h1>
        <p className="mt-2 text-sm text-ink-muted">
          The LOC officer uses the operational console and cannot change
          tournament policy.
        </p>
        <Link href="/" className={`${primary} mt-5`}>
          Return to LOC console
        </Link>
      </div>
    </main>
  );
}

function ControlWorkspace({
  me,
  onSignedOut,
}: {
  me: Me;
  onSignedOut: () => void;
}) {
  const [data, setData] = useState<LaunchConfigurationResponse | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      setData(await api.launchConfiguration());
    } catch (reason) {
      setError(reason);
    }
  }, []);
  useEffect(() => {
    let active = true;
    void api
      .launchConfiguration()
      .then((configuration) => {
        if (active) setData(configuration);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason);
      });
    return () => {
      active = false;
    };
  }, []);
  async function signOut() {
    await api.logout().catch(() => {});
    onSignedOut();
  }
  if (!data)
    return (
      <main className="flex min-h-screen items-center justify-center">
        <ErrorNotice error={error} />
      </main>
    );

  async function transition(kind: "publish" | "lock") {
    setError(null);
    setNotice(null);
    try {
      const next =
        kind === "publish"
          ? await api.publishLaunchConfiguration()
          : await api.lockLaunchConfiguration();
      setData(next);
      setNotice(
        kind === "publish"
          ? "Configuration published to registration surfaces."
          : "Competition configuration locked.",
      );
    } catch (reason) {
      setError(reason);
    }
  }

  return (
    <div className="min-h-screen bg-bg">
      <header className="sticky top-0 z-20 border-b-[3px] border-gold bg-navy-deep text-white">
        <div className="mx-auto flex h-[72px] max-w-[94rem] items-center gap-4 px-4 sm:px-6 lg:px-8">
          <div>
            <div className="font-display text-lg font-bold">GameDay</div>
            <div className="font-mono text-[0.55rem] uppercase tracking-[0.16em] text-gold-bright">
              SportsBB control plane
            </div>
          </div>
          <div className="ml-auto hidden text-right sm:block">
            <p className="text-sm font-semibold">{me.user?.displayName}</p>
            <p className="font-mono text-[0.55rem] uppercase tracking-[0.08em] text-white/55">
              platform administrator
            </p>
          </div>
          <a
            href="/control/public"
            className="rounded-lg border border-white/15 bg-white/[0.06] px-3 py-2 text-xs font-semibold text-white hover:bg-white/10"
          >
            Public experience
          </a>
          <button
            className="min-h-10 rounded-lg px-3 text-xs font-semibold text-white/70 hover:bg-white/10"
            onClick={signOut}
          >
            Sign out
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-[94rem] space-y-6 px-4 py-7 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-mono text-[0.64rem] font-bold uppercase tracking-[0.12em] text-gold-deep">
              Launch Module
            </p>
            <h1 className="mt-1 font-display text-3xl font-bold text-ink">
              Tournament configuration
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-muted">
              One governed event contract for registration, accreditation,
              credentials, public publication and later GameDay operations.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Status
              status={data.event.configurationStatus}
              version={data.event.configurationVersion}
            />
            {data.event.configurationStatus !== "locked" && (
              <button
                className={gold}
                disabled={!data.readiness.ready}
                onClick={() => transition("publish")}
              >
                Publish version
              </button>
            )}
            {data.event.configurationStatus === "published" && (
              <button className={primary} onClick={() => transition("lock")}>
                Lock configuration
              </button>
            )}
          </div>
        </div>
        <ErrorNotice error={error} />
        {notice && (
          <div
            role="status"
            className="rounded-xl border border-ok-line bg-ok-soft p-4 text-sm font-semibold text-ok"
          >
            {notice}
          </div>
        )}
        <Readiness readiness={data.readiness} />
        <ConfigurationForm data={data} onSaved={setData} onError={setError} />
        <Countries
          countries={data.countries}
          onChanged={load}
          onError={setError}
        />
      </main>
    </div>
  );
}

function Status({ status, version }: { status: string; version: number }) {
  const style =
    status === "published"
      ? "border-ok-line bg-ok-soft text-ok"
      : status === "locked"
        ? "border-navy/20 bg-navy-tint text-navy"
        : "border-warn-line bg-warn-soft text-warn";
  return (
    <span
      className={`rounded-full border px-3 py-1.5 font-mono text-[0.6rem] font-bold uppercase tracking-[0.08em] ${style}`}
    >
      {status} · v{version}
    </span>
  );
}

function Readiness({
  readiness,
}: {
  readiness: LaunchConfigurationResponse["readiness"];
}) {
  return (
    <section className={`${panel} p-5`}>
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-bold text-ink">
          Publish readiness
        </h2>
        <span
          className={`font-mono text-[0.6rem] font-bold uppercase ${readiness.ready ? "text-ok" : "text-warn"}`}
        >
          {readiness.ready
            ? "Ready"
            : `${readiness.problems.length} outstanding`}
        </span>
      </div>
      {readiness.problems.length ? (
        <ul className="mt-3 grid gap-2 text-sm text-ink-soft sm:grid-cols-2">
          {readiness.problems.map((problem) => (
            <li key={problem} className="rounded-lg bg-bg-soft px-3 py-2">
              {problem}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-ok">
          The launch contract satisfies every required publication check.
        </p>
      )}
    </section>
  );
}

function ConfigurationForm({
  data,
  onSaved,
  onError,
}: {
  data: LaunchConfigurationResponse;
  onSaved: (data: LaunchConfigurationResponse) => void;
  onError: (error: unknown) => void;
}) {
  const event = data.event;
  const [form, setForm] = useState(() => formFrom(event));
  const [busy, setBusy] = useState(false);
  const set = (key: keyof typeof form, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));
  const toggle = (
    key:
      | "requiredOfficialRoles"
      | "identityRequiredCategories"
      | "consentRequiredCategories",
    value: string,
  ) =>
    setForm((current) => ({
      ...current,
      [key]: current[key].includes(value)
        ? current[key].filter((item) => item !== value)
        : [...current[key], value],
    }));
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    onError(null);
    try {
      const next = await api.updateLaunchConfiguration({
        name: form.name,
        shortName: form.shortName,
        timezone: form.timezone,
        startsOn: form.startsOn,
        endsOn: form.endsOn,
        eligibilityDate: form.eligibilityDate,
        registrationOpensAt: form.registrationOpensAt
          ? new Date(form.registrationOpensAt).toISOString()
          : null,
        registrationClosesAt: form.registrationClosesAt
          ? new Date(form.registrationClosesAt).toISOString()
          : null,
        activePlayerMinimum: Number(form.activePlayerMinimum),
        activePlayerMaximum: Number(form.activePlayerMaximum),
        reserveMaximum: Number(form.reserveMaximum),
        benchMaximum: Number(form.benchMaximum),
        biographyMinimumCharacters: Number(form.biographyMinimumCharacters),
        requiredOfficialRoles: form.requiredOfficialRoles,
        identityRequiredCategories: form.identityRequiredCategories,
        consentRequiredCategories: form.consentRequiredCategories,
        eligibilityRegulationReference: form.eligibilityRegulationReference,
        accessZoneMatrix: JSON.parse(form.accessZoneMatrix) as Record<
          string,
          string[]
        >,
        brandPrimaryLogoUrl: form.brandPrimaryLogoUrl,
        brandReverseLogoUrl: form.brandReverseLogoUrl,
      });
      onSaved(next);
      setForm(formFrom(next.event));
    } catch (reason) {
      onError(reason);
    } finally {
      setBusy(false);
    }
  }
  const disabled = event.configurationStatus === "locked";
  return (
    <form onSubmit={submit} className="space-y-6">
      <section
        className={`${panel} grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3`}
      >
        <SectionTitle
          title="Event identity"
          description="Shared identity consumed by every GameDay surface."
        />
        <Field
          labelText="Tournament name"
          value={form.name}
          onChange={(v) => set("name", v)}
          required
        />
        <Field
          labelText="Short name"
          value={form.shortName}
          onChange={(v) => set("shortName", v)}
          required
        />
        <Field
          labelText="Timezone"
          value={form.timezone}
          onChange={(v) => set("timezone", v)}
          required
        />
        <Field
          type="date"
          labelText="Starts"
          value={form.startsOn}
          onChange={(v) => set("startsOn", v)}
          required
        />
        <Field
          type="date"
          labelText="Ends"
          value={form.endsOn}
          onChange={(v) => set("endsOn", v)}
          required
        />
        <Field
          type="date"
          labelText="Age assessment date"
          value={form.eligibilityDate}
          onChange={(v) => set("eligibilityDate", v)}
          required
          hint="The date on which each player's age is calculated—normally the first tournament day. Do not enter the 18th-birthday cutoff year."
        />
        <Field
          type="datetime-local"
          labelText="Registration opens"
          value={form.registrationOpensAt}
          onChange={(v) => set("registrationOpensAt", v)}
          required
        />
        <Field
          type="datetime-local"
          labelText="Registration closes"
          value={form.registrationClosesAt}
          onChange={(v) => set("registrationClosesAt", v)}
          required
        />
      </section>
      <section
        className={`${panel} grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-5`}
      >
        <SectionTitle
          title="Team policy"
          description="Server-enforced limits used by registration and LOC approval."
        />
        <Field
          type="number"
          labelText="Active minimum"
          value={form.activePlayerMinimum}
          onChange={(v) => set("activePlayerMinimum", v)}
          required
        />
        <Field
          type="number"
          labelText="Active maximum"
          value={form.activePlayerMaximum}
          onChange={(v) => set("activePlayerMaximum", v)}
          required
        />
        <Field
          type="number"
          labelText="Reserve maximum"
          value={form.reserveMaximum}
          onChange={(v) => set("reserveMaximum", v)}
          required
        />
        <Field
          type="number"
          labelText="Bench maximum"
          value={form.benchMaximum}
          onChange={(v) => set("benchMaximum", v)}
          required
        />
        <Field
          type="number"
          labelText="Biography minimum"
          value={form.biographyMinimumCharacters}
          onChange={(v) => set("biographyMinimumCharacters", v)}
          required
        />
        <CheckboxGroup
          title="Required team-official roles"
          values={officialRoles}
          selected={form.requiredOfficialRoles}
          onToggle={(value) => toggle("requiredOfficialRoles", value)}
        />
        <CheckboxGroup
          title="Identity documents required"
          values={personCategories}
          selected={form.identityRequiredCategories}
          onToggle={(value) => toggle("identityRequiredCategories", value)}
        />
        <CheckboxGroup
          title="Guardian consent policy applies to"
          values={personCategories}
          selected={form.consentRequiredCategories}
          onToggle={(value) => toggle("consentRequiredCategories", value)}
        />
        <label className="sm:col-span-2 lg:col-span-5">
          <span className={label}>Eligibility regulation reference</span>
          <textarea
            className={input}
            rows={3}
            value={form.eligibilityRegulationReference}
            onChange={(e) =>
              set("eligibilityRegulationReference", e.target.value)
            }
          />
        </label>
      </section>
      <section className={`${panel} grid gap-4 p-5 sm:grid-cols-2`}>
        <SectionTitle
          title="Brand and accreditation"
          description="Official graphics and category-to-zone policy remain event configuration."
        />
        <Field
          labelText="Primary logo asset path"
          value={form.brandPrimaryLogoUrl}
          onChange={(v) => set("brandPrimaryLogoUrl", v)}
          required
        />
        <Field
          labelText="Reverse logo asset path"
          value={form.brandReverseLogoUrl}
          onChange={(v) => set("brandReverseLogoUrl", v)}
        />
        {assetUrl(form.brandPrimaryLogoUrl) && (
          <div className="rounded-xl border border-line bg-bg-soft p-4">
            <p className={label}>Primary preview</p>
            <Image
              src={assetUrl(form.brandPrimaryLogoUrl)!}
              alt="Configured tournament logo"
              width={420}
              height={112}
              unoptimized
              className="mt-2 max-h-28 max-w-full object-contain"
            />
          </div>
        )}
        <label>
          <span className={label}>Access-zone matrix (JSON)</span>
          <textarea
            className={`${input} font-mono text-xs`}
            rows={9}
            value={form.accessZoneMatrix}
            onChange={(e) => set("accessZoneMatrix", e.target.value)}
          />
        </label>
      </section>
      <button className={primary} disabled={busy || disabled}>
        {disabled
          ? "Configuration locked"
          : busy
            ? "Saving configuration…"
            : "Save as new draft version"}
      </button>
    </form>
  );
}

function formFrom(event: LaunchConfiguration) {
  return {
    name: event.name,
    shortName: event.shortName ?? "",
    timezone: event.timezone,
    startsOn: event.startsOn ?? "",
    endsOn: event.endsOn ?? "",
    eligibilityDate: event.eligibilityDate ?? "",
    registrationOpensAt: toLocal(event.registrationOpensAt),
    registrationClosesAt: toLocal(event.registrationClosesAt),
    activePlayerMinimum: String(event.activePlayerMinimum),
    activePlayerMaximum: String(event.activePlayerMaximum),
    reserveMaximum: String(event.reserveMaximum),
    benchMaximum: String(event.benchMaximum),
    biographyMinimumCharacters: String(event.biographyMinimumCharacters),
    requiredOfficialRoles: event.requiredOfficialRoles,
    identityRequiredCategories: event.identityRequiredCategories,
    consentRequiredCategories: event.consentRequiredCategories,
    eligibilityRegulationReference: event.eligibilityRegulationReference ?? "",
    accessZoneMatrix: JSON.stringify(event.accessZoneMatrix, null, 2),
    brandPrimaryLogoUrl: event.brandPrimaryLogoUrl ?? "",
    brandReverseLogoUrl: event.brandReverseLogoUrl ?? "",
  };
}

function SectionTitle({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="sm:col-span-2 lg:col-span-full">
      <h2 className="font-display text-xl font-bold text-ink">{title}</h2>
      <p className="mt-1 text-sm text-ink-muted">{description}</p>
    </div>
  );
}
function Field({
  labelText,
  value,
  onChange,
  type = "text",
  required = false,
  hint,
}: {
  labelText: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  hint?: string;
}) {
  return (
    <label>
      <span className={label}>{labelText}</span>
      <input
        className={input}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
      />
      {hint && (
        <span className="mt-1 block text-xs leading-5 text-ink-muted">
          {hint}
        </span>
      )}
    </label>
  );
}
function CheckboxGroup({
  title,
  values,
  selected,
  onToggle,
}: {
  title: string;
  values: string[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <fieldset className="rounded-xl border border-line p-4 sm:col-span-2 lg:col-span-5">
      <legend className={`${label} px-1`}>{title}</legend>
      <div className="flex flex-wrap gap-3">
        {values.map((value) => (
          <label
            key={value}
            className="inline-flex items-center gap-2 rounded-lg bg-bg-soft px-3 py-2 text-sm text-ink-soft"
          >
            <input
              type="checkbox"
              checked={selected.includes(value)}
              onChange={() => onToggle(value)}
              className="accent-navy"
            />
            {value.replaceAll("_", " ")}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function Countries({
  countries,
  onChanged,
  onError,
}: {
  countries: EligibleCountry[];
  onChanged: () => void;
  onError: (error: unknown) => void;
}) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    onError(null);
    try {
      await api.addEligibleCountry({ code, name });
      setCode("");
      setName("");
      onChanged();
    } catch (reason) {
      onError(reason);
    } finally {
      setBusy(false);
    }
  }
  async function remove(countryCode: string) {
    onError(null);
    try {
      await api.removeEligibleCountry(countryCode);
      onChanged();
    } catch (reason) {
      onError(reason);
    }
  }
  return (
    <section className={`${panel} overflow-hidden`}>
      <div className="border-b border-line p-5">
        <h2 className="font-display text-xl font-bold text-ink">
          Eligible countries
        </h2>
        <p className="mt-1 text-sm text-ink-muted">
          One delegation may register for each configured country.
        </p>
      </div>
      <div className="grid gap-2 p-5 sm:grid-cols-2 lg:grid-cols-4">
        {countries.map((country) => (
          <div
            key={country.code}
            className="flex items-center gap-3 rounded-xl border border-line p-3"
          >
            <span className="rounded-md bg-navy-tint px-2 py-1 font-mono text-xs font-bold text-navy">
              {country.code}
            </span>
            <span className="min-w-0 flex-1 text-sm font-semibold text-ink">
              {country.name}
            </span>
            <button
              type="button"
              onClick={() => remove(country.code)}
              className="text-xs font-semibold text-bad hover:underline"
            >
              Remove
            </button>
          </div>
        ))}
      </div>
      <form
        onSubmit={add}
        className="grid gap-3 border-t border-line bg-bg-soft/50 p-5 sm:grid-cols-[8rem_1fr_auto]"
      >
        <label>
          <span className={label}>Code</span>
          <input
            className={input}
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            minLength={2}
            maxLength={3}
            required
          />
        </label>
        <label>
          <span className={label}>Country name</span>
          <input
            className={input}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </label>
        <button className={`${primary} self-end`} disabled={busy}>
          {busy ? "Adding…" : "Add country"}
        </button>
      </form>
    </section>
  );
}
