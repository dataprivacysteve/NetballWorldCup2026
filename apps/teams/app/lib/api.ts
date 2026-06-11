// Client for the GameDay teams API. Auth is a session cookie (httpOnly, set by
// the API on login/register), so every request uses credentials:"include" and
// there is no client-managed tenant header — tenancy comes from the session.
const BASE = process.env.NEXT_PUBLIC_API_BASE_URL as string;

export class ApiError extends Error {
  constructor(
    public status: number,
    public payload: unknown,
  ) {
    super(
      typeof payload === "object" && payload && "message" in payload
        ? String((payload as { message: unknown }).message)
        : `Request failed (${status})`,
    );
  }
}

async function req<T>(
  path: string,
  opts: { method?: string; body?: unknown; form?: FormData } = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  let body: BodyInit | undefined;
  if (opts.form) {
    body = opts.form;
  } else if (opts.body !== undefined) {
    headers["content-type"] = "application/json";
    body = JSON.stringify(opts.body);
  }
  const res = await fetch(`${BASE}${path}`, {
    method: opts.method ?? "GET",
    headers,
    body,
    credentials: "include",
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new ApiError(res.status, data);
  return data as T;
}

// ---- Types ----------------------------------------------------------------
export type Country = { code: string; name: string };
export type RegistrationStatus =
  | "draft"
  | "submitted"
  | "approved"
  | "rejected";
export type Delegation = {
  id: string;
  name: string;
  countryCode: string;
  registrationStatus: RegistrationStatus;
  status: "draft" | "submitted";
  associationName: string | null;
  headOfDelegation: string | null;
  headCoach: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  expectedSquadSize: number | null;
  travellingParty: number | null;
  arrivalDate: string | null;
  departureDate: string | null;
  notes: string | null;
  submittedAt: string | null;
  approvedAt: string | null;
};
export type Me = {
  user: { email: string; displayName: string; isAdmin: boolean } | null;
  delegation: {
    id: string;
    name: string;
    countryCode: string;
    registrationStatus: RegistrationStatus;
    status: string;
  } | null;
};
export type Category =
  | "player"
  | "official"
  | "technical"
  | "media"
  | "broadcast";
export type Person = {
  id: string;
  firstName: string;
  lastName: string;
  category: Category;
  role: string | null;
  dateOfBirth: string | null;
  jerseyNumber: number | null;
  isMinor: boolean;
  hasPhoto: boolean;
  ready: boolean;
};
export type Consent = {
  id: string;
  type: "player" | "guardian";
  consentGiven: boolean;
  consentingPartyName: string;
  relationship: string | null;
  consentingPartyPhone: string | null;
};

// ---- Static reference (matches the API) -----------------------------------
export const POSITIONS = [
  "Goal Shooter",
  "Goal Attack",
  "Wing Attack",
  "Centre",
  "Wing Defence",
  "Goal Defence",
  "Goal Keeper",
];
export const CATEGORIES: { value: Category; label: string }[] = [
  { value: "player", label: "Player" },
  { value: "official", label: "Team Official" },
  { value: "technical", label: "Technical Official" },
  { value: "media", label: "Media" },
  { value: "broadcast", label: "Broadcast" },
];

// ---- Endpoints ------------------------------------------------------------
export const api = {
  me: async (): Promise<Me | null> => {
    try {
      return await req<Me>("/me");
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return null;
      throw e;
    }
  },
  login: (email: string, password: string) =>
    req<Me>("/login", { method: "POST", body: { email, password } }),
  logout: () => req<{ ok: boolean }>("/logout", { method: "POST" }),

  eligibleCountries: () => req<Country[]>("/eligible-countries"),
  register: (b: {
    countryCode: string;
    associationName: string;
    headOfDelegation: string;
    headCoach?: string;
    contactEmail: string;
    password: string;
    contactPhone: string;
    expectedSquadSize?: number;
    dpaConsent: boolean;
  }) => req<Me>("/register", { method: "POST", body: b }),

  getDelegation: () => req<Delegation>("/delegation"),
  submitRoster: () =>
    req<Delegation>("/delegation/submit", { method: "POST" }),

  listPlayers: () => req<Person[]>("/players"),
  createPerson: (b: {
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    category: Category;
    role?: string;
    jerseyNumber?: number;
  }) => req<Person>("/players", { method: "POST", body: b }),
  deletePerson: (id: string) =>
    req<{ deleted: boolean }>(`/players/${id}`, { method: "DELETE" }),

  listConsents: (id: string) =>
    req<Consent[]>(`/players/${id}/consents`),
  addConsent: (
    id: string,
    b: {
      type: "player" | "guardian";
      consentGiven: boolean;
      consentingPartyName: string;
      relationship?: string;
      consentingPartyPhone?: string;
    },
  ) => req<Consent>(`/players/${id}/consents`, { method: "POST", body: b }),
  deleteConsent: (id: string, consentId: string) =>
    req<{ deleted: boolean }>(`/players/${id}/consents/${consentId}`, {
      method: "DELETE",
    }),

  uploadPhoto: (id: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return req<unknown>(`/players/${id}/photo`, { method: "POST", form });
  },
  photoImageUrl: async (id: string): Promise<string | null> => {
    const res = await fetch(`${BASE}/players/${id}/photo/image`, {
      credentials: "include",
    });
    if (!res.ok) return null;
    return URL.createObjectURL(await res.blob());
  },
};
