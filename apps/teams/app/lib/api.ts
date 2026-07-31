import { showSuccessToast } from "../components/toast";

// Client for the GameDay teams API. Auth is a session cookie (httpOnly, set by
// the API on login/register), so every request uses credentials:"include" and
// there is no client-managed tenant header — tenancy comes from the session.
const BASE = process.env.NEXT_PUBLIC_API_BASE_URL as string;

function successMessage(path: string): string {
  if (path === "/register") return "Your team registration was received and is awaiting LOC approval.";
  if (path.includes("submit-partial")) return "Your available team information was received for rolling LOC review.";
  if (path.includes("submit")) return path.includes("team-sheet") ? "The match team sheet was submitted." : "Your team was submitted for accreditation review.";
  if (path.includes("identity")) return "The restricted identity document was received for LOC verification.";
  if (path.includes("photo")) return "The profile photograph was uploaded.";
  if (path.includes("consent")) return "The consent record was saved.";
  if (path.includes("team-sheet")) return "The match team sheet was saved.";
  if (path.includes("players")) return "The team member information was saved.";
  if (path.includes("registration")) return "The team registration information was saved.";
  return "Your changes were saved successfully.";
}

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
    signal: AbortSignal.timeout(12_000),
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new ApiError(res.status, data);
  if ((opts.method ?? "GET").toUpperCase() !== "GET" && path !== "/login" && path !== "/logout") {
    showSuccessToast(successMessage(path));
  }
  return data as T;
}

// ---- Types ----------------------------------------------------------------
export type Country = { code: string; name: string };
export type RegistrationWindow = {
  opensAt: string | null;
  closesAt: string | null;
  open: boolean;
  phase: "configuration" | "scheduled" | "open" | "closed";
  tournament: {
    name: string;
    shortName: string | null;
    timezone: string;
    brandPrimaryLogoUrl: string | null;
  } | null;
  policy: {
    activePlayerMinimum: number;
    activePlayerMaximum: number;
    reserveMaximum: number;
    benchMaximum: number;
    biographyMinimumCharacters: number;
    requiredOfficialRoles: string[];
    identityRequiredCategories: string[];
    consentRequiredCategories: string[];
    eligibilityRegulationReference: string | null;
  } | null;
};
export type RegistrationStatus =
  | "draft"
  | "submitted"
  | "approved"
  | "rejected";
export type Delegation = {
  id: string;
  name: string;
  countryCode: string;
  countryName: string | null;
  registrationStatus: RegistrationStatus;
  status: "draft" | "submitted" | "under_review" | "approved" | "rejected";
  associationName: string | null;
  headOfDelegation: string | null;
  headCoach: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  contactRoleTitle: string | null;
  expectedSquadSize: number | null;
  travellingParty: number | null;
  arrivalDate: string | null;
  departureDate: string | null;
  notes: string | null;
  submittedAt: string | null;
  approvedAt: string | null;
  registrationReviewNote: string | null;
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
  middleNames: string | null;
  lastName: string;
  nationality: string;
  biography: string;
  category: Category;
  role: string | null;
  dateOfBirth: string | null;
  jerseyNumber: number | null;
  rosterType: "active" | "reserve" | null;
  officialRole: "team_manager" | "coach" | "primary_care" | "other" | null;
  otherOfficialTitle: string | null;
  isHeadOfDelegation: boolean;
  benchEligible: boolean;
  nationalityMatchesTeam: boolean;
  eligibilityConfirmed: boolean;
  eligibilityReference: string | null;
  identityStatus: "pending" | "verified" | "rejected" | null;
  identityRequired: boolean;
  consentRequired: boolean;
  dobRequired: boolean;
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
export type IdentityStatus = {
  id: string;
  documentType: "passport" | "national_id";
  issuingCountry: string;
  nationality: string;
  expiresOn: string | null;
  status: "pending" | "verified" | "rejected";
  reviewNote: string | null;
  uploadedAt: string;
  verifiedAt: string | null;
};

export type TeamMatch = {
  id: string;
  scheduledAt: string | null;
  roundLabel: string | null;
  status: string;
  teamADelegationId: string;
  teamBDelegationId: string;
  teamACode: string;
  teamAName: string;
  teamBCode: string;
  teamBName: string;
  venue: string | null;
  court: string | null;
};
export type TeamSheetDetail = {
  match: TeamMatch;
  side: "A" | "B";
  sheet: {
    status: "draft" | "submitted" | "locked";
    version: number;
    submittedAt: string | null;
  };
  roster: Array<{
    id: string;
    firstName: string;
    lastName: string;
    jerseyNumber: number | null;
    primaryPosition: string | null;
    rosterType: "active" | "reserve" | null;
    accredited: "issued" | "revoked" | null;
  }>;
  players: Array<{
    playerId: string;
    startingPosition: string | null;
    captain: boolean;
  }>;
};

export type PersonPayload = {
  firstName: string;
  middleNames?: string;
  lastName: string;
  nationality: string;
  biography: string;
  dateOfBirth?: string;
  category: Category;
  role?: string;
  jerseyNumber?: number;
  rosterType?: "active" | "reserve";
  officialRole?: "team_manager" | "coach" | "primary_care" | "other";
  otherOfficialTitle?: string;
  isHeadOfDelegation?: boolean;
  benchEligible?: boolean;
  nationalityMatchesTeam: boolean;
  eligibilityConfirmed: boolean;
  eligibilityReference?: string;
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
  requestPasswordReset: (email: string) =>
    req<{ accepted: boolean; devResetToken?: string }>(
      "/password-reset/request",
      {
        method: "POST",
        body: { email },
      },
    ),
  completePasswordReset: (token: string, password: string) =>
    req<{ reset: boolean }>("/password-reset/complete", {
      method: "POST",
      body: { token, password },
    }),

  eligibleCountries: () => req<Country[]>("/eligible-countries"),
  registrationWindow: () => req<RegistrationWindow>("/registration-window"),
  register: (b: {
    countryCode: string;
    teamName: string;
    associationName: string;
    teamManager: string;
    contactEmail: string;
    password: string;
    confirmPassword: string;
    contactPhone: string;
    expectedSquadSize: number;
    dpaConsent: boolean;
  }) => req<Me>("/register", { method: "POST", body: b }),

  getDelegation: () => req<Delegation>("/delegation"),
  updateRegistration: (
    body: Partial<{
      name: string;
      countryCode: string;
      associationName: string;
      headOfDelegation: string;
      headCoach: string;
      contactName: string;
      contactPhone: string;
      contactRoleTitle: string;
      expectedSquadSize: number;
      travellingParty: number;
      arrivalDate: string;
      departureDate: string;
      notes: string;
    }>,
  ) => req<Delegation>("/delegation", { method: "PATCH", body }),
  resubmitRegistration: () =>
    req<Delegation>("/delegation/registration/submit", { method: "POST" }),
  submitRoster: () => req<Delegation>("/delegation/submit", { method: "POST" }),
  submitPartialRoster: () =>
    req<Delegation>("/delegation/submit-partial", { method: "POST" }),

  listPlayers: () => req<Person[]>("/players"),
  teamMatches: () => req<TeamMatch[]>("/team-matches"),
  teamSheet: (matchId: string) =>
    req<TeamSheetDetail>(`/team-matches/${matchId}/team-sheet`),
  saveTeamSheet: (
    matchId: string,
    expectedVersion: number,
    players: Array<{
      playerId: string;
      startingPosition?: string | null;
      captain?: boolean;
    }>,
  ) =>
    req<TeamSheetDetail>(`/team-matches/${matchId}/team-sheet`, {
      method: "PUT",
      body: { expectedVersion, players },
    }),
  submitTeamSheet: (matchId: string, expectedVersion: number) =>
    req<TeamSheetDetail>(`/team-matches/${matchId}/team-sheet/submit`, {
      method: "POST",
      body: { expectedVersion },
    }),
  createPerson: (b: PersonPayload) =>
    req<Person>("/players", { method: "POST", body: b }),
  updatePerson: (id: string, b: Partial<PersonPayload>) =>
    req<Person>(`/players/${id}`, { method: "PATCH", body: b }),
  deletePerson: (id: string) =>
    req<{ deleted: boolean }>(`/players/${id}`, { method: "DELETE" }),

  listConsents: (id: string) => req<Consent[]>(`/players/${id}/consents`),
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
  identityStatus: (id: string) =>
    req<IdentityStatus | null>(`/players/${id}/identity`),
  uploadIdentity: (
    id: string,
    fields: {
      documentType: "passport" | "national_id";
      issuingCountry: string;
      nationality: string;
      expiresOn?: string;
    },
    file: File,
  ) => {
    const form = new FormData();
    form.append("file", file);
    Object.entries(fields).forEach(([key, value]) => {
      if (value) form.append(key, value);
    });
    return req<IdentityStatus>(`/players/${id}/identity`, {
      method: "POST",
      form,
    });
  },
  photoImageUrl: async (id: string): Promise<string | null> => {
    const res = await fetch(`${BASE}/players/${id}/photo/image`, {
      credentials: "include",
    });
    if (!res.ok) return null;
    return URL.createObjectURL(await res.blob());
  },
  // View-only credential QR (no download — printing/use is the OC's function).
  credentialQrUrl: async (id: string): Promise<string | null> => {
    const res = await fetch(`${BASE}/players/${id}/credential/qr`, {
      credentials: "include",
    });
    if (!res.ok) return null;
    return URL.createObjectURL(await res.blob());
  },
};
