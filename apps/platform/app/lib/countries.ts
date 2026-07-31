import countries from "i18n-iso-countries";
import en from "i18n-iso-countries/langs/en.json";

countries.registerLocale(en);

export function countryLabel(code: string | null | undefined) {
  if (!code) return "Not provided";
  const normalized = code.trim().toUpperCase();
  const name = countries.getName(normalized, "en");
  return name ? `${name} — ${normalized}` : `Unknown country code — ${normalized}`;
}
