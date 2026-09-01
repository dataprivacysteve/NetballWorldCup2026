"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { api, type SponsorConfig } from "./lib/api";

const input =
  "enterprise-input w-full rounded-lg border border-line-strong bg-white px-3 py-2 text-sm text-ink";
const label =
  "mb-1 block font-mono text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-ink-muted";
const panel = "enterprise-panel";
const primary =
  "enterprise-button inline-flex items-center justify-center rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white disabled:opacity-50";
const gold =
  "enterprise-button inline-flex items-center justify-center rounded-lg bg-gold px-4 py-2 text-sm font-bold text-navy-deep disabled:opacity-50";
const ghost =
  "enterprise-button inline-flex items-center justify-center rounded-lg border border-line-strong bg-white px-4 py-2 text-sm font-semibold text-ink-soft disabled:opacity-50";

type Draft = {
  id?: string;
  name: string;
  tier: SponsorConfig["tier"];
  destinationUrl: string;
  websiteEnabled: boolean;
  displayEnabled: boolean;
  displaySeconds: number;
  active: boolean;
  sortOrder: number;
  logoUrl: string;
  displayImageUrl: string;
};

const emptyDraft: Draft = {
  name: "",
  tier: "gold",
  destinationUrl: "",
  websiteEnabled: false,
  displayEnabled: false,
  displaySeconds: 10,
  active: true,
  sortOrder: 0,
  logoUrl: "",
  displayImageUrl: "",
};

const placements: Record<
  SponsorConfig["tier"],
  { label: string; size: string }
> = {
  gold: { label: "Gold billboard", size: "970 × 200 px" },
  silver: { label: "Silver banner", size: "1200 × 200 px" },
  bronze: { label: "Bronze banner", size: "1200 × 200 px" },
  supporter: { label: "Partner logo strip", size: "600 × 300 px" },
};

export default function Advertising() {
  const [rows, setRows] = useState<SponsorConfig[] | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [websiteFile, setWebsiteFile] = useState<File | null>(null);
  const [displayFile, setDisplayFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setRows(await api.advertisements());
  }, []);

  useEffect(() => {
    void load().catch((reason: unknown) =>
      setError(reason instanceof Error ? reason.message : "Advertising could not load."),
    );
  }, [load]);

  function reset() {
    setDraft(emptyDraft);
    setWebsiteFile(null);
    setDisplayFile(null);
  }

  function edit(row: SponsorConfig) {
    setDraft({
      id: row.id,
      name: row.name,
      tier: row.tier,
      destinationUrl: row.destinationUrl ?? "",
      websiteEnabled: row.websiteEnabled,
      displayEnabled: row.displayEnabled,
      displaySeconds: row.displaySeconds,
      active: row.active,
      sortOrder: row.sortOrder,
      logoUrl: row.logoUrl ?? "",
      displayImageUrl: row.displayImageUrl ?? "",
    });
    setWebsiteFile(null);
    setDisplayFile(null);
    setNotice(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!draft.websiteEnabled && !draft.displayEnabled) {
      setError("Choose at least one placement: Website or In-house display.");
      return;
    }
    if (draft.websiteEnabled && !draft.logoUrl && !websiteFile) {
      setError("Choose a website creative before enabling the website placement.");
      return;
    }
    if (draft.displayEnabled && !draft.displayImageUrl && !displayFile) {
      setError("Choose a 1500 × 500 in-house creative before enabling display rotation.");
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      let saved = await api.saveAdvertisement({
        id: draft.id,
        name: draft.name.trim(),
        tier: draft.tier,
        destinationUrl: draft.destinationUrl.trim() || null,
        logoUrl: draft.logoUrl || null,
        websiteEnabled: draft.websiteEnabled,
        displayImageUrl: draft.displayImageUrl || null,
        displayEnabled: draft.displayEnabled,
        displaySeconds: draft.displaySeconds,
        active: draft.active,
        sortOrder: draft.sortOrder,
      });
      if (websiteFile) {
        saved = await api.uploadAdvertisementCreative(saved.id, "website", websiteFile);
      }
      if (displayFile) {
        saved = await api.uploadAdvertisementCreative(saved.id, "display", displayFile);
      }
      setNotice(
        saved.active
          ? saved.name + " is published to its selected placements."
          : saved.name + " was saved as a draft.",
      );
      reset();
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Advertisement could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(row: SponsorConfig) {
    if (!window.confirm("Remove " + row.name + " from advertising management?")) return;
    setBusy(true);
    setError(null);
    try {
      await api.deleteAdvertisement(row.id);
      if (draft.id === row.id) reset();
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Advertisement could not be removed.");
    } finally {
      setBusy(false);
    }
  }

  async function moveInHouse(row: SponsorConfig, direction: -1 | 1) {
    if (!rows) return;
    const rotation = rows.filter((item) => item.displayEnabled);
    const currentIndex = rotation.findIndex((item) => item.id === row.id);
    const targetIndex = currentIndex + direction;
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= rotation.length) return;

    const reordered = [...rotation];
    [reordered[currentIndex], reordered[targetIndex]] = [
      reordered[targetIndex],
      reordered[currentIndex],
    ];

    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      for (const [index, item] of reordered.entries()) {
        await api.saveAdvertisement({
          id: item.id,
          name: item.name,
          tier: item.tier,
          logoUrl: item.logoUrl,
          destinationUrl: item.destinationUrl,
          websiteEnabled: item.websiteEnabled,
          displayImageUrl: item.displayImageUrl,
          displayEnabled: item.displayEnabled,
          displaySeconds: item.displaySeconds,
          active: item.active,
          sortOrder: (index + 1) * 10,
        });
      }
      setNotice(row.name + " moved " + (direction < 0 ? "earlier" : "later") + " in the in-house rotation.");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The rotation order could not be changed.");
    } finally {
      setBusy(false);
    }
  }

  const creativeAssets = (rows ?? []).flatMap((row) => {
    const assets: Array<{
      id: string;
      campaign: string;
      surface: string;
      specification: string;
      url: string;
      active: boolean;
    }> = [];
    if (row.logoUrl) {
      assets.push({
        id: row.id + "-website",
        campaign: row.name,
        surface: placements[row.tier].label,
        specification: placements[row.tier].size,
        url: row.logoUrl,
        active: row.active && row.websiteEnabled,
      });
    }
    if (row.displayImageUrl) {
      assets.push({
        id: row.id + "-display",
        campaign: row.name,
        surface: "In-house display",
        specification: "1500 × 500 px",
        url: row.displayImageUrl,
        active: row.active && row.displayEnabled,
      });
    }
    return assets;
  });

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className={label}>Commercial operations</p>
          <h1 className="font-display text-3xl font-bold text-ink">Advertising</h1>
          <p className="mt-2 max-w-3xl text-sm text-ink-muted">
            Manage the website’s designed ad placements and the rotating 1500 × 500 in-house scoreboard banner.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href="https://www.netballamericas.test/" target="_blank" rel="noreferrer" className={ghost}>
            Preview website
          </a>
          <a href="/display" target="_blank" rel="noreferrer" className={primary}>
            Preview in-house display
          </a>
        </div>
      </header>

      {error && (
        <p role="alert" className="rounded-xl border border-bad-line bg-bad-soft p-3 text-sm text-bad">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="rounded-xl border border-ok-line bg-ok-soft p-3 text-sm text-ok">
          {notice}
        </p>
      )}

      <section className={panel + " overflow-hidden"}>
        <div className="border-b border-line px-5 py-4">
          <h2 className="font-display text-xl font-bold text-ink">Creative specifications</h2>
          <p className="mt-1 text-sm text-ink-muted">
            JPEG, PNG and WebP uploads are normalized automatically without stretching.
          </p>
        </div>
        <div className="grid gap-px bg-line sm:grid-cols-2 xl:grid-cols-4">
          {Object.values(placements).map((placement) => (
            <div key={placement.label} className="bg-white p-4">
              <p className="text-sm font-bold text-ink">{placement.label}</p>
              <p className="mt-1 font-mono text-xs text-ink-muted">{placement.size}</p>
            </div>
          ))}
        </div>
        <div className="border-t border-line bg-navy-deep px-5 py-4 text-white">
          <p className="text-sm font-bold text-gold-bright">In-house rotation</p>
          <p className="mt-1 text-sm text-white/70">
            1500 × 500 px · 3:1 ratio · displayed below the match clock
          </p>
        </div>
      </section>

      <form onSubmit={save} className={panel + " space-y-5 p-5 sm:p-6"}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-bold text-ink">
              {draft.id ? "Edit advertisement" : "Add advertisement"}
            </h2>
            <p className="mt-1 text-sm text-ink-muted">
              Choose Website, In-house display, or both. Website placements use one active creative per designed slot.
            </p>
          </div>
          {draft.id && (
            <button type="button" className={ghost} onClick={reset}>Cancel editing</button>
          )}
        </div>

        <div className="grid gap-4">
          <label>
            <span className={label}>Partner / campaign name</span>
            <input
              className={input}
              required
              minLength={2}
              value={draft.name}
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
            />
          </label>
          <div>
            <p className={label}>Placements</p>
            <p className="text-sm text-ink-muted">
              Choose one or both destinations. The image upload will appear inside each selected placement.
            </p>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <CreativePanel
            title="Website"
            checked={draft.websiteEnabled}
            onChecked={(websiteEnabled) => setDraft({ ...draft, websiteEnabled })}
            help="Use one of the website’s designed advertising spaces."
            currentUrl={draft.logoUrl}
            currentAlt="Current website creative"
            selected={websiteFile}
            onFile={setWebsiteFile}
          >
            <label className="mt-3 block">
              <span className={label}>Website slot</span>
              <select
                className={input}
                value={draft.tier}
                onChange={(event) =>
                  setDraft({ ...draft, tier: event.target.value as SponsorConfig["tier"] })
                }
              >
                {Object.entries(placements).map(([value, placement]) => (
                  <option key={value} value={value}>
                    {placement.label} · {placement.size}
                  </option>
                ))}
              </select>
            </label>
            <label className="mt-3 block">
              <span className={label}>Click-through destination (optional)</span>
              <input
                className={input}
                type="url"
                placeholder="https://partner.example/"
                value={draft.destinationUrl}
                onChange={(event) =>
                  setDraft({ ...draft, destinationUrl: event.target.value })
                }
              />
            </label>
            <p className="mt-3 text-xs leading-5 text-ink-muted">
              Upload size: {placements[draft.tier].size}
            </p>
          </CreativePanel>
          <div className="rounded-xl border border-line bg-bg-soft/45 p-4">
            <label className="flex items-center gap-3 font-semibold text-ink">
              <input
                type="checkbox"
                checked={draft.displayEnabled}
                onChange={(event) =>
                  setDraft({ ...draft, displayEnabled: event.target.checked })
                }
              />
              In-house display
            </label>
            <p className="mt-2 text-xs leading-5 text-ink-muted">
              1500 × 500 px · normalized to 3:1 · shown below the clock
            </p>
            {draft.displayEnabled && (
              <>
                <FileInput
                  labelText="Upload in-house display image"
                  selected={displayFile}
                  onFile={setDisplayFile}
                />
                <label className="mt-3 block">
                  <span className={label}>Seconds per rotation</span>
                  <input
                    className={input}
                    type="number"
                    min={5}
                    max={60}
                    value={draft.displaySeconds}
                    onChange={(event) =>
                      setDraft({ ...draft, displaySeconds: Number(event.target.value) })
                    }
                  />
                </label>
                {draft.displayImageUrl && !displayFile && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={draft.displayImageUrl}
                    alt="Current in-house creative"
                    className="mt-3 aspect-[3/1] w-full rounded-lg border border-line bg-navy-deep object-contain"
                  />
                )}
              </>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm font-semibold text-ink">
            <input
              type="checkbox"
              checked={draft.active}
              onChange={(event) => setDraft({ ...draft, active: event.target.checked })}
            />
            {draft.active ? "Publish campaign immediately" : "Keep as draft"}
          </label>
          <button className={gold} disabled={busy}>
            {busy
              ? "Saving…"
              : draft.active
                ? draft.id
                  ? "Save & publish changes"
                  : "Publish campaign"
                : "Save draft"}
          </button>
          <p className="text-xs text-ink-muted">
            Published campaigns appear on their selected placements after saving.
          </p>
        </div>
      </form>

      <section>
        <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className={label}>Creative asset library ({creativeAssets.length})</h2>
            <p className="text-sm text-ink-muted">
              A visual record of every website and in-house image uploaded to the system.
            </p>
          </div>
        </div>
        <div className={panel + " p-4"}>
          {rows === null ? (
            <p className="text-sm text-ink-muted">Loading creative assets…</p>
          ) : creativeAssets.length === 0 ? (
            <p className="text-sm text-ink-muted">
              No images have been published yet. Uploaded images will appear here after the campaign is saved.
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {creativeAssets.map((asset) => (
                <article key={asset.id} className="overflow-hidden rounded-xl border border-line bg-white">
                  <div className="flex h-40 items-center justify-center bg-navy-deep p-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={asset.url}
                      alt={asset.campaign + " " + asset.surface + " creative"}
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                  <div className="p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-bold text-ink">{asset.campaign}</h3>
                        <p className="mt-1 text-xs text-ink-muted">
                          {asset.surface} · {asset.specification}
                        </p>
                      </div>
                      <span className={asset.active ? "rounded-full bg-ok-soft px-2 py-1 text-[0.68rem] font-bold text-ok" : "rounded-full bg-bg-soft px-2 py-1 text-[0.68rem] font-bold text-ink-muted"}>
                        {asset.active ? "Published" : "Not live"}
                      </span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      <section>
        <h2 className={label}>Managed advertisements ({rows?.length ?? 0})</h2>
        <div className={panel + " divide-y divide-line"}>
          {rows === null ? (
            <p className="p-5 text-sm text-ink-muted">Loading advertisements…</p>
          ) : rows.length === 0 ? (
            <p className="p-5 text-sm text-ink-muted">
              No advertisements configured. Add the first campaign above.
            </p>
          ) : (
            rows.map((row) => {
              const rotation = rows.filter((item) => item.displayEnabled);
              const rotationIndex = rotation.findIndex((item) => item.id === row.id);
              return (
                <div
                  key={row.id}
                  className="grid gap-4 p-5 lg:grid-cols-[minmax(0,1fr)_15rem_auto] lg:items-center"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-display text-lg font-bold text-ink">{row.name}</h3>
                      <span className={row.active ? "rounded-full bg-ok-soft px-2 py-1 text-xs font-bold text-ok" : "rounded-full bg-bg-soft px-2 py-1 text-xs font-bold text-ink-muted"}>
                        {row.active ? "Active" : "Paused"}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-ink-muted">
                      {row.websiteEnabled ? placements[row.tier].label : "Website off"}
                      {" · "}
                      {row.displayEnabled
                        ? "In-house rotation " + (rotationIndex + 1) + " of " + rotation.length + " · " + row.displaySeconds + "s"
                        : "In-house off"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {row.logoUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={row.logoUrl} alt="" className="h-14 min-w-0 flex-1 rounded border border-line bg-white object-contain" />
                    )}
                    {row.displayImageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={row.displayImageUrl} alt="" className="h-14 min-w-0 flex-1 rounded border border-line bg-navy-deep object-contain" />
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {row.displayEnabled && (
                      <>
                        <button
                          type="button"
                          className={ghost}
                          onClick={() => void moveInHouse(row, -1)}
                          disabled={busy || rotationIndex <= 0}
                        >
                          ↑ Earlier
                        </button>
                        <button
                          type="button"
                          className={ghost}
                          onClick={() => void moveInHouse(row, 1)}
                          disabled={busy || rotationIndex >= rotation.length - 1}
                        >
                          ↓ Later
                        </button>
                      </>
                    )}
                    <button type="button" className={ghost} onClick={() => edit(row)} disabled={busy}>Edit</button>
                    <button
                      type="button"
                      className={ghost + " text-bad"}
                      onClick={() => void remove(row)}
                      disabled={busy}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}

function CreativePanel({
  title,
  checked,
  onChecked,
  help,
  currentUrl,
  currentAlt,
  selected,
  onFile,
  children,
}: {
  title: string;
  checked: boolean;
  onChecked: (checked: boolean) => void;
  help: string;
  currentUrl: string;
  currentAlt: string;
  selected: File | null;
  onFile: (file: File | null) => void;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-line bg-bg-soft/45 p-4">
      <label className="flex items-center gap-3 font-semibold text-ink">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onChecked(event.target.checked)}
        />
        {title}
      </label>
      <p className="mt-2 text-xs leading-5 text-ink-muted">{help}</p>
      {checked && (
        <>
          {children}
          <FileInput
            labelText="Upload website image"
            selected={selected}
            onFile={onFile}
          />
          {currentUrl && !selected && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={currentUrl}
              alt={currentAlt}
              className="mt-3 max-h-32 w-full rounded-lg border border-line bg-white object-contain"
            />
          )}
        </>
      )}
    </div>
  );
}

function FileInput({
  labelText,
  selected,
  onFile,
}: {
  labelText: string;
  selected: File | null;
  onFile: (file: File | null) => void;
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!selected) {
      setPreviewUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(selected);
    setPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [selected]);

  return (
    <div className="mt-3 overflow-hidden rounded-xl border-2 border-dashed border-gold bg-white transition hover:border-navy focus-within:ring-2 focus-within:ring-gold focus-within:ring-offset-2">
      {previewUrl && (
        <div className="flex h-40 items-center justify-center border-b border-line bg-navy-deep p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt="Selected creative preview"
            className="max-h-full max-w-full object-contain"
          />
        </div>
      )}
      <label className="group flex cursor-pointer items-center gap-4 p-4 hover:bg-gold/10">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-navy text-gold">
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="h-6 w-6"
          >
            <path d="M12 16V4m0 0-4 4m4-4 4 4" />
            <path d="M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" />
          </svg>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-ink">{labelText}</span>
          <span className="mt-1 block text-xs text-ink-muted">
            JPEG, PNG or WebP
          </span>
          <span className="mt-2 inline-flex rounded-md bg-gold px-3 py-1.5 text-xs font-bold text-navy-deep transition group-hover:bg-navy group-hover:text-white">
            {selected ? "Replace image" : "Choose image"}
          </span>
          {selected && (
            <span className="mt-2 block truncate text-xs font-semibold text-ok">
              Ready to publish: {selected.name}
            </span>
          )}
        </span>
        <input
          className="sr-only"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(event) => onFile(event.target.files?.[0] ?? null)}
        />
      </label>
    </div>
  );
}
