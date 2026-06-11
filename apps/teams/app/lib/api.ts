// Thin client for the GameDay API. The delegation id is kept in localStorage
// as a DEV stand-in for the authenticated session that arrives in Module 2;
// it is sent as the x-delegation-id header the API's TenantInterceptor reads.
const BASE = process.env.NEXT_PUBLIC_API_BASE_URL as string;
const KEY = "gameday.delegationId";

export function getDelegationId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(KEY);
}
export function setDelegationId(id: string) {
  localStorage.setItem(KEY, id);
}
export function clearDelegationId() {
  localStorage.removeItem(KEY);
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public payload: unknown,
  ) {
    super(typeof payload === "object" && payload && "message" in payload
      ? String((payload as { message: unknown }).message)
      : `Request failed (${status})`);
  }
}

type Options = {
  method?: string;
  body?: unknown;
  tenant?: boolean;
  form?: FormData;
};

async function req<T>(path: string, opts: Options = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (opts.tenant) {
    const id = getDelegationId();
    if (id) headers["x-delegation-id"] = id;
  }
  let body: BodyInit | undefined;
  if (opts.form) {
    body = opts.form; // browser sets multipart content-type
  } else if (opts.body !== undefined) {
    headers["content-type"] = "application/json";
    body = JSON.stringify(opts.body);
  }
  const res = await fetch(`${BASE}${path}`, {
    method: opts.method ?? "GET",
    headers,
    body,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new ApiError(res.status, data);
  return data as T;
}

// ---- Types ----------------------------------------------------------------
export type Delegation = {
  id: string;
  name: string;
  countryCode: string;
  status: "draft" | "submitted" | "under_review" | "approved" | "rejected";
  submittedAt: string | null;
};
export type Player = {
  id: string;
  fullName: string;
  position: string | null;
  jerseyNumber: number | null;
  requiresGuardianConsent: boolean;
};
export type Consent = {
  id: string;
  type: "player" | "guardian";
  consentGiven: boolean;
  consentingPartyName: string;
  relationship: string | null;
};
export type Photo = {
  id: string;
  objectKey: string;
  status: string;
  uploadedAt: string | null;
};

// ---- Endpoints ------------------------------------------------------------
export const api = {
  register: (b: {
    name: string;
    countryCode: string;
    managerEmail: string;
    managerName: string;
  }) => req<Delegation>("/delegations", { method: "POST", body: b }),

  getDelegation: () => req<Delegation>("/delegation", { tenant: true }),
  updateDelegation: (b: { name?: string; countryCode?: string }) =>
    req<Delegation>("/delegation", { method: "PATCH", body: b, tenant: true }),
  submit: () =>
    req<Delegation>("/delegation/submit", { method: "POST", tenant: true }),

  listPlayers: () => req<Player[]>("/players", { tenant: true }),
  createPlayer: (b: {
    fullName: string;
    position?: string;
    jerseyNumber?: number;
    requiresGuardianConsent?: boolean;
  }) => req<Player>("/players", { method: "POST", body: b, tenant: true }),
  deletePlayer: (id: string) =>
    req<{ deleted: boolean }>(`/players/${id}`, {
      method: "DELETE",
      tenant: true,
    }),

  listConsents: (playerId: string) =>
    req<Consent[]>(`/players/${playerId}/consents`, { tenant: true }),
  addConsent: (
    playerId: string,
    b: {
      type: "player" | "guardian";
      consentGiven: boolean;
      consentingPartyName: string;
      relationship?: string;
    },
  ) =>
    req<Consent>(`/players/${playerId}/consents`, {
      method: "POST",
      body: b,
      tenant: true,
    }),

  listPhotos: (playerId: string) =>
    req<Photo[]>(`/players/${playerId}/photos`, { tenant: true }),
  uploadPhoto: (playerId: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return req<Photo>(`/players/${playerId}/photo`, {
      method: "POST",
      form,
      tenant: true,
    });
  },
};
