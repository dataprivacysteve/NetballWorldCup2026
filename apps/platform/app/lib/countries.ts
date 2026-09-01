import countries from "i18n-iso-countries";
import en from "i18n-iso-countries/langs/en.json";

countries.registerLocale(en);

export function countryLabel(code: string | null | undefined) {
  if (!code) return "Not provided";
  const normalized = code.trim().toUpperCase();
  const name = countries.getName(normalized, "en");
  return name ? `${name} — ${normalized}` : `Unknown country code — ${normalized}`;
}

export function countryFlag(code: string | null | undefined) {
  if (!code) return "🌐";
  const normalized = code.trim().toUpperCase();
  const alpha2 =
    normalized.length === 2 ? normalized : countries.alpha3ToAlpha2(normalized);
  if (!alpha2 || alpha2.length !== 2) return "🌐";
  return String.fromCodePoint(
    ...alpha2.split("").map((letter) => 0x1f1e6 + letter.charCodeAt(0) - 65),
  );
}
