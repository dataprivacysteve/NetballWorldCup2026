"use client";

import countries from "i18n-iso-countries";
import en from "i18n-iso-countries/langs/en.json";

countries.registerLocale(en);

const COUNTRY_OPTIONS = Object.entries(countries.getNames("en"))
  .map(([alpha2, name]) => ({ code: countries.alpha2ToAlpha3(alpha2) ?? "", name }))
  .filter((country) => country.code)
  .sort((a, b) => a.name.localeCompare(b.name));

export function CountrySelect({
  label,
  value,
  onChange,
  className,
  required = true,
}: {
  label: string;
  value: string;
  onChange: (code: string) => void;
  className: string;
  required?: boolean;
}) {
  const normalized = value.trim().toUpperCase();
  const known = COUNTRY_OPTIONS.some((country) => country.code === normalized);
  return (
    <label className="block">
      <span className="mb-1 block font-mono text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-ink-muted">{label}</span>
      <select className={className} value={known ? normalized : ""} onChange={(event) => onChange(event.target.value)} required={required}>
        <option value="">Select a country or nationality…</option>
        {COUNTRY_OPTIONS.map((country) => (
          <option key={country.code} value={country.code}>{country.name} — {country.code}</option>
        ))}
      </select>
      <span className="mt-1 block text-xs text-ink-muted">The standard three-letter code is stored automatically.</span>
    </label>
  );
}
