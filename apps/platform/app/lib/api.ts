// Client for the OC operations console. Cookie-based auth shared with the API
// (the session cookie is scoped to .netballamericas.test), so an admin signed
// in here is recognised by the API's AdminGuard.
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
  opts: { method?: string; body?: unknown } = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  let body: BodyInit | undefined;
  if (opts.body !== undefined) {
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

export type Me = {
  user: { email: string; displayName: string; isAdmin: boolean } | null;
};
export type PendingDelegation = {
  id: string;
  name: string;
  countryCode: string;
  associationName: string | null;
  headOfDelegation: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  expectedSquadSize: number | null;
  registrationSubmittedAt: string | null;
};

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

  listPending: () => req<PendingDelegation[]>("/admin/delegations"),
  approve: (id: string) =>
    req<{ id: string; name: string; registrationStatus: string }>(
      `/admin/delegations/${id}/approve`,
      { method: "POST" },
    ),
  reject: (id: string) =>
    req<{ id: string; name: string; registrationStatus: string }>(
      `/admin/delegations/${id}/reject`,
      { method: "POST" },
    ),
};
