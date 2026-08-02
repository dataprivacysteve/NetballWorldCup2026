import { showSuccessToast } from "../components/toast";

// Client for the OC operations console. Cookie-based auth shared with the API
// (the session cookie is scoped to .netballamericas.test), so an admin signed
// in here is recognised by the API's AdminGuard.
const BASE = process.env.NEXT_PUBLIC_API_BASE_URL as string;

function successMessage(path: string): string {
  if (path.includes("/admin/review/") && path.endsWith("/approve")) return "The team was approved and accreditation status was updated.";
  if (path.includes("approve")) return "The delegation registration was approved.";
  if (path.includes("reject")) return "The delegation registration was returned with the recorded reason.";
  if (path.includes("return")) return "The record was returned to the team with your review note.";
  if (path.includes("verify") || path.includes("identity")) return "Verification was recorded successfully.";
  if (path.includes("registration-window")) return "The registration window settings were saved.";
  if (path.includes("credential")) return "The credential action was completed.";
  if (path.includes("match")) return "The match information was saved.";
  if (path.includes("country")) return "The eligible-country list was updated.";
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
    signal: AbortSignal.timeout(12_000),
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new ApiError(res.status, data);
  if ((opts.method ?? "GET").toUpperCase() !== "GET" && path !== "/login" && path !== "/logout" && !path.startsWith("/gameday/") && !path.startsWith("/admin/scan/")) {
    showSuccessToast(successMessage(path));
  }
  return data as T;
}

export type Me = {
  user: {
    email: string;
    displayName: string;
    isAdmin: boolean;
    platformRole:
      | "sportsbb_admin"
      | "loc_officer"
      | "match_supervisor"
      | "scorer"
      | "timekeeper"
      | "stats_lineup"
      | "result_approver"
      | null;
  } | null;
};
export type PendingDelegation = {
  id: string;
  name: string;
  countryCode: string;
  associationName: string | null;
  headOfDelegation: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  contactRoleTitle: string | null;
  expectedSquadSize: number | null;
  registrationSubmittedAt: string | null;
};
export type RegistrationRecord = PendingDelegation & {
  contactName: string | null;
  registrationStatus: "draft" | "submitted" | "approved" | "rejected";
  registrationReviewNote: string | null;
  approvedAt: string | null;
  rosterStatus: "draft" | "submitted" | "approved" | "rejected";
  rosterSubmittedAt: string | null;
  accreditedAt: string | null;
  playerCount: number;
  officialCount: number;
};

export type RegWindow = {
  opensAt: string | null;
  closesAt: string | null;
  open: boolean;
};
export type EligibleCountry = { code: string; name: string };
export type LaunchConfiguration = {
  id: string;
  slug: string;
  name: string;
  shortName: string | null;
  timezone: string;
  startsOn: string | null;
  endsOn: string | null;
  eligibilityDate: string | null;
  registrationOpensAt: string | null;
  registrationClosesAt: string | null;
  activePlayerMinimum: number;
  activePlayerMaximum: number;
  reserveMaximum: number;
  benchMaximum: number;
  biographyMinimumCharacters: number;
  requiredOfficialRoles: string[];
  identityRequiredCategories: string[];
  consentRequiredCategories: string[];
  eligibilityRegulationReference: string | null;
  accessZoneMatrix: Record<string, string[]>;
  brandPrimaryLogoUrl: string | null;
  brandReverseLogoUrl: string | null;
  configurationStatus: "draft" | "published" | "locked";
  configurationVersion: number;
  configurationPublishedAt: string | null;
};
export type LaunchConfigurationResponse = {
  event: LaunchConfiguration;
  countries: EligibleCountry[];
  readiness: { ready: boolean; problems: string[] };
};
export type PublicExperienceConfig = {
  tournamentId: string;
  heroImageUrl: string | null;
  heroStrapline: string | null;
  ticketsUrl: string | null;
  merchandiseUrl: string | null;
  merchandiseImageUrl: string | null;
  aboutText: string | null;
  contactEmail: string | null;
  delayedUpdatesMessage: string;
  updatedAt: string;
};
export type SponsorConfig = {
  id: string;
  name: string;
  tier: "gold" | "silver" | "bronze" | "supporter";
  logoUrl: string | null;
  destinationUrl: string | null;
  active: boolean;
  sortOrder: number;
};
export type NewsConfig = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  body: string | null;
  imageUrl: string | null;
  published: boolean;
  publishedAt: string | null;
};
export type PublicExperienceResponse = {
  experience: PublicExperienceConfig | null;
  sponsors: SponsorConfig[];
  news: NewsConfig[];
};
export type AuditEvent = {
  id: string;
  action: string;
  targetType: string;
  targetId: string | null;
  details: Record<string, unknown> | null;
  createdAt: string;
  actorName: string;
  targetName: string | null;
  countryCode: string | null;
};
export type AccreditedDelegation = {
  id: string;
  name: string;
  countryCode: string;
  accreditedAt: string | null;
};
export type ScanResult =
  | {
      valid: true;
      credentialId: string;
      person: {
        id: string;
        firstName: string;
        lastName: string;
        category: string;
        role: string | null;
      } | null;
      delegation: { name: string; countryCode: string } | null;
    }
  | { valid: false; reason: string };
export type GateScanEvent = {
  id: string;
  valid: boolean;
  reason: string | null;
  credentialId: string | null;
  source: "online" | "offline_sync";
  scannedAt: string;
  createdAt: string;
  actorName: string;
};
export type OfflineGateCredential = {
  id: string;
  tokenHash: string;
  status: "issued" | "revoked";
  category: string;
  issuedAt: string;
  firstName: string;
  lastName: string;
  role: string | null;
  delegationName: string;
  countryCode: string;
};
export type OfflineGateBundle = {
  version: number;
  generatedAt: string;
  expiresAt: string;
  credentials: OfflineGateCredential[];
};
export type OfflineScanEvent = {
  clientEventId: string;
  token: string;
  scannedAt: string;
  offlineValid: boolean;
  offlineReason?: string;
};
export type ReviewQueueItem = {
  id: string;
  name: string;
  countryCode: string;
  status: string;
  submittedAt: string | null;
};
export type ReviewPerson = {
  id: string;
  firstName: string;
  middleNames: string | null;
  lastName: string;
  nationality: string;
  biography: string;
  category: string;
  role: string | null;
  dateOfBirth: string | null;
  isMinor: boolean;
  rosterType: "active" | "reserve" | null;
  officialRole: "team_manager" | "coach" | "primary_care" | "other" | null;
  otherOfficialTitle: string | null;
  isHeadOfDelegation: boolean;
  benchEligible: boolean;
  nationalityMatchesTeam: boolean;
  eligibilityConfirmed: boolean;
  eligibilityReference: string | null;
  checks: { photo: boolean; dob: boolean; consent: boolean; identity: string };
  identityDocument: {
    id: string;
    documentType: "passport" | "national_id";
    issuingCountry: string;
    nationality: string;
    expiresOn: string | null;
    status: "pending" | "verified" | "rejected";
    reviewNote: string | null;
    hasFile: boolean;
    verifiedAt: string | null;
  } | null;
  consentRecord: {
    type: "player" | "guardian";
    consentingPartyName: string;
    relationship: string | null;
    consentedAt: string | null;
  } | null;
  ready: boolean;
  verificationStatus: "pending" | "verified" | "returned";
  verificationNote: string | null;
  reviewedAt: string | null;
  credentialId: string | null;
  credentialStatus: "issued" | "revoked" | null;
};
export type ReviewDetail = {
  delegation: {
    id: string;
    name: string;
    countryCode: string;
    associationName: string | null;
    status: string;
    submittedAt: string | null;
    reviewNote: string | null;
    accreditedAt: string | null;
  };
  configuration: {
    accessZoneMatrix: Record<string, string[]>;
    brandPrimaryLogoUrl: string | null;
  };
  people: ReviewPerson[];
};

// ---- Match centre (Module 4 writer) ----
export type MatchNation = { id: string; countryCode: string; name: string };
export type StageEntry = {
  delegationId: string;
  countryCode: string;
  name: string;
  sortOrder: number;
};
export type Stage = {
  id: string;
  name: string;
  kind: string;
  sortOrder: number;
  entries: StageEntry[];
};
export type AdminMatch = {
  id: string;
  stageId: string | null;
  stageName: string | null;
  scheduledAt: string | null;
  venue: string | null;
  court: string | null;
  roundLabel: string | null;
  status:
    | "scheduled"
    | "ready"
    | "live"
    | "suspended"
    | "awaiting_confirmation"
    | "final"
    | "postponed"
    | "cancelled";
  teamAScore: number;
  teamBScore: number;
  sortOrder: number;
  teamAId: string;
  teamACode: string;
  teamAName: string;
  teamBId: string;
  teamBCode: string;
  teamBName: string;
  courtId: string | null;
};
export type MatchVenue = {
  id: string;
  name: string;
  address: string | null;
  timezone: string;
  courts: { id: string; name: string }[];
};
export type NewMatch = {
  stageId?: string | null;
  teamADelegationId: string;
  teamBDelegationId: string;
  scheduledAt?: string | null;
  courtId?: string | null;
  roundLabel?: string | null;
};
export type MatchPatch = Partial<{
  stageId: string | null;
  scheduledAt: string | null;
  courtId: string | null;
  roundLabel: string | null;
  status: AdminMatch["status"];
}>;
export type MatchBroadcast = {
  matchId: string;
  provider: string | null;
  externalId: string | null;
  watchUrl: string | null;
  embedUrl: string | null;
  replayUrl: string | null;
  status: "unassigned" | "scheduled" | "live" | "ended" | "archived";
  featured: boolean;
  updatedAt: string | null;
};
export type EdgeNode = {
  id: string;
  name: string;
  venueId: string | null;
  venue: string | null;
  active: boolean;
  lastSeenAt: string | null;
  lastPullAt: string | null;
  lastPushAt: string | null;
  lastError: string | null;
  createdAt: string;
};

export type GameDayRole =
  | "match_supervisor"
  | "scorer"
  | "timekeeper"
  | "stats_lineup"
  | "result_approver";
export type GameDayAccount = {
  id: string;
  email: string;
  displayName: string;
  role: GameDayRole;
  createdAt?: string;
};
export type GameDayAssignment = {
  id: string;
  appUserId: string;
  displayName: string;
  email: string;
  role: GameDayRole;
};
export type GameDayMatch = {
  id: string;
  assignmentRole: GameDayRole;
  scheduledAt: string | null;
  roundLabel: string | null;
  status: AdminMatch["status"];
  teamAScore: number;
  teamBScore: number;
  teamACode: string;
  teamAName: string;
  teamBCode: string;
  teamBName: string;
  venue: string | null;
  court: string | null;
  currentPeriod: number;
  periodDurationSeconds: number;
  clockRemainingSeconds: number;
  clockRunning: boolean;
  version: number;
};
export type GameDayRuntime = {
  mode: "cloud" | "edge";
  node: {
    id: string;
    name: string;
    lastSeenAt: string | null;
    lastPullAt: string | null;
    lastPushAt: string | null;
    lastError: string | null;
  } | null;
  serverTime: string;
};
export type GameDayState = {
  match: {
    id: string;
    status: AdminMatch["status"];
    teamADelegationId: string;
    teamBDelegationId: string;
    teamAScore: number;
    teamBScore: number;
    currentPeriod: number;
    periodDurationSeconds: number;
    clockRemainingSeconds: number;
    clockRunning: boolean;
    centrePassTeam: "A" | "B" | null;
    version: number;
  };
  events: Array<{
    id: string;
    sequence: number;
    eventType: string;
    teamSide: "A" | "B" | null;
    playerId: string | null;
    period: number | null;
    clockSeconds: number | null;
    payload: Record<string, unknown> | null;
    recordedAt: string;
  }>;
  teamSheets: Array<{
    id: string;
    delegationId: string;
    status: string;
    players: Array<{
      playerId: string;
      firstName: string;
      lastName: string;
      jerseyNumber: number | null;
      currentPosition: string | null;
      startingPosition: string | null;
      bench: boolean;
    }>;
  }>;
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
  listRegistrations: () => req<RegistrationRecord[]>("/admin/registrations"),
  approve: (id: string) =>
    req<{ id: string; name: string; registrationStatus: string }>(
      `/admin/delegations/${id}/approve`,
      { method: "POST" },
    ),
  reject: (id: string, reason: string) =>
    req<{ id: string; name: string; registrationStatus: string }>(
      `/admin/delegations/${id}/reject`,
      { method: "POST", body: { reason } },
    ),

  // Registration window (cutoff)
  getRegistrationWindow: () => req<RegWindow>("/admin/registration-window"),
  setRegistrationWindow: (closesAt: string | null) =>
    req<RegWindow>("/admin/registration-window", {
      method: "PATCH",
      body: { closesAt },
    }),
  auditHistory: () => req<AuditEvent[]>("/admin/audit"),

  // SportsBB control plane (separate from the LOC officer authority).
  launchConfiguration: () =>
    req<LaunchConfigurationResponse>("/control/configuration"),
  updateLaunchConfiguration: (body: Partial<LaunchConfiguration>) =>
    req<LaunchConfigurationResponse>("/control/configuration", {
      method: "PATCH",
      body,
    }),
  publishLaunchConfiguration: () =>
    req<LaunchConfigurationResponse>("/control/configuration/publish", {
      method: "POST",
    }),
  lockLaunchConfiguration: () =>
    req<LaunchConfigurationResponse>("/control/configuration/lock", {
      method: "POST",
    }),
  addEligibleCountry: (body: EligibleCountry) =>
    req<EligibleCountry>("/control/countries", { method: "POST", body }),
  updateEligibleCountry: (code: string, name: string) =>
    req<EligibleCountry>(`/control/countries/${code}`, {
      method: "PATCH",
      body: { name },
    }),
  removeEligibleCountry: (code: string) =>
    req<{ ok: boolean }>(`/control/countries/${code}`, { method: "DELETE" }),
  controlAudit: () => req<AuditEvent[]>("/control/audit"),
  publicExperience: () =>
    req<PublicExperienceResponse>("/control/public-experience"),
  updatePublicExperience: (
    body: Partial<Omit<PublicExperienceConfig, "tournamentId" | "updatedAt">>,
  ) =>
    req<PublicExperienceConfig>("/control/public-experience", {
      method: "PATCH",
      body,
    }),
  saveSponsor: (
    body: Partial<SponsorConfig> & Pick<SponsorConfig, "name" | "tier">,
  ) => req<SponsorConfig>("/control/sponsors", { method: "POST", body }),
  deleteSponsor: (id: string) =>
    req<{ ok: boolean }>(`/control/sponsors/${id}`, { method: "DELETE" }),
  saveNews: (
    body: Partial<NewsConfig> & Pick<NewsConfig, "slug" | "title" | "summary">,
  ) => req<NewsConfig>("/control/news", { method: "POST", body }),
  deleteNews: (id: string) =>
    req<{ ok: boolean }>(`/control/news/${id}`, { method: "DELETE" }),

  // Badges + gate scan
  listAccredited: () => req<AccreditedDelegation[]>("/admin/accredited"),
  verifyScan: (token: string) =>
    req<ScanResult>("/admin/scan/verify", { method: "POST", body: { token } }),
  gateHistory: () => req<GateScanEvent[]>("/admin/scan/history"),
  offlineGateBundle: () => req<OfflineGateBundle>("/admin/scan/offline-bundle"),
  syncOfflineScans: (events: OfflineScanEvent[]) =>
    req<{
      accepted: number;
      rejected: number;
      outcomes: Array<{
        clientEventId: string;
        accepted: boolean;
        duplicate: boolean;
      }>;
    }>("/admin/scan/sync", { method: "POST", body: { events } }),
  revokeCredential: (id: string, reason: string) =>
    req<{ id: string; status: "revoked" }>(`/admin/credentials/${id}/revoke`, {
      method: "POST",
      body: { reason },
    }),
  reissueCredential: (id: string) =>
    req<{ id: string; status: "issued" }>(`/admin/credentials/${id}/reissue`, {
      method: "POST",
    }),

  // Roster accreditation review
  listReview: () => req<ReviewQueueItem[]>("/admin/review"),
  reviewDetail: (id: string) => req<ReviewDetail>(`/admin/review/${id}`),
  approveRoster: (id: string) =>
    req<{ accredited: boolean; issued: number; total: number }>(
      `/admin/review/${id}/approve`,
      { method: "POST" },
    ),
  verifyPerson: (delegationId: string, playerId: string) =>
    req(`/admin/review/${delegationId}/people/${playerId}/verify`, {
      method: "POST",
    }),
  returnPerson: (delegationId: string, playerId: string, note: string) =>
    req(`/admin/review/${delegationId}/people/${playerId}/return`, {
      method: "POST",
      body: { note },
    }),
  returnRoster: (id: string, note: string) =>
    req<{ id: string; status: string }>(`/admin/review/${id}/return`, {
      method: "POST",
      body: { note },
    }),
  verifyIdentity: (
    playerId: string,
    documentId: string,
    status: "verified" | "rejected",
    note?: string,
  ) =>
    req(`/admin/players/${playerId}/identity/verify`, {
      method: "POST",
      body: { documentId, status, note },
    }),

  // Match centre (fixtures / results / standings writer)
  matchNations: () => req<MatchNation[]>("/admin/match/nations"),
  matchVenues: () => req<MatchVenue[]>("/admin/match/venues"),
  createMatchVenue: (body: {
    name: string;
    address?: string;
    timezone?: string;
  }) => req<MatchVenue>("/admin/match/venues", { method: "POST", body }),
  createMatchCourt: (venueId: string, name: string) =>
    req<{ id: string; name: string; venueId: string }>(
      `/admin/match/venues/${venueId}/courts`,
      {
        method: "POST",
        body: { name },
      },
    ),
  stages: () => req<Stage[]>("/admin/match/stages"),
  createStage: (name: string, kind: "group" | "knockout", sortOrder: number) =>
    req<Stage>("/admin/match/stages", {
      method: "POST",
      body: { name, kind, sortOrder },
    }),
  addEntry: (stageId: string, delegationId: string) =>
    req<{ ok: boolean }>(`/admin/match/stages/${stageId}/entries`, {
      method: "POST",
      body: { delegationId },
    }),
  removeEntry: (stageId: string, delegationId: string) =>
    req<{ ok: boolean }>(
      `/admin/match/stages/${stageId}/entries/${delegationId}`,
      { method: "DELETE" },
    ),
  matches: () => req<AdminMatch[]>("/admin/match/matches"),
  createMatch: (body: NewMatch) =>
    req<AdminMatch>("/admin/match/matches", { method: "POST", body }),
  updateMatch: (id: string, body: MatchPatch) =>
    req<AdminMatch>(`/admin/match/matches/${id}`, { method: "PATCH", body }),
  deleteMatch: (id: string) =>
    req<{ ok: boolean }>(`/admin/match/matches/${id}`, { method: "DELETE" }),
  matchBroadcast: (id: string) =>
    req<MatchBroadcast>(`/admin/match/matches/${id}/broadcast`),
  updateMatchBroadcast: (
    id: string,
    body: Omit<MatchBroadcast, "matchId" | "updatedAt">,
  ) =>
    req<MatchBroadcast>(`/admin/match/matches/${id}/broadcast`, {
      method: "PATCH",
      body,
    }),
  edgeNodes: () => req<EdgeNode[]>("/admin/match/edge-nodes"),
  createEdgeNode: (name: string, venueId?: string) =>
    req<EdgeNode>("/admin/match/edge-nodes", {
      method: "POST",
      body: { name, venueId: venueId || undefined },
    }),
  deactivateEdgeNode: (id: string) =>
    req<EdgeNode>(`/admin/match/edge-nodes/${id}`, { method: "DELETE" }),
  gameDayAccounts: () => req<GameDayAccount[]>("/admin/match/officials"),
  createGameDayAccount: (body: {
    email: string;
    displayName: string;
    password: string;
    role: GameDayRole;
  }) => req<GameDayAccount>("/admin/match/officials", { method: "POST", body }),
  gameDayAssignments: (matchId: string) =>
    req<GameDayAssignment[]>(`/admin/match/matches/${matchId}/assignments`),
  assignGameDayOfficial: (
    matchId: string,
    appUserId: string,
    role: GameDayRole,
  ) =>
    req<GameDayAssignment>(`/admin/match/matches/${matchId}/assignments`, {
      method: "POST",
      body: { appUserId, role },
    }),
  unassignGameDayOfficial: (matchId: string, role: GameDayRole) =>
    req<{ ok: boolean }>(
      `/admin/match/matches/${matchId}/assignments/${role}`,
      {
        method: "DELETE",
      },
    ),

  gameDayMatches: () => req<GameDayMatch[]>("/gameday/matches"),
  gameDayRuntime: () => req<GameDayRuntime>("/gameday/runtime"),
  gameDayState: (id: string) => req<GameDayState>(`/gameday/matches/${id}`),
  readyMatch: (id: string, expectedVersion: number) =>
    req(`/gameday/matches/${id}/ready`, {
      method: "POST",
      body: { expectedVersion },
    }),
  recordGoal: (
    id: string,
    expectedVersion: number,
    teamSide: "A" | "B",
    playerId?: string,
  ) =>
    req(`/gameday/matches/${id}/goals`, {
      method: "POST",
      body: { expectedVersion, teamSide, playerId },
    }),
  correctGoal: (
    id: string,
    expectedVersion: number,
    eventId: string,
    reason: string,
  ) =>
    req(`/gameday/matches/${id}/goals/correct`, {
      method: "POST",
      body: { expectedVersion, eventId, reason },
    }),
  setCentrePass: (id: string, expectedVersion: number, teamSide: "A" | "B") =>
    req(`/gameday/matches/${id}/centre-pass`, {
      method: "POST",
      body: { expectedVersion, teamSide },
    }),
  recordIncident: (
    id: string,
    expectedVersion: number,
    incidentType: "injury" | "warning" | "suspension" | "technical" | "other",
    note: string,
    teamSide?: "A" | "B",
    playerId?: string,
  ) =>
    req(`/gameday/matches/${id}/incidents`, {
      method: "POST",
      body: { expectedVersion, incidentType, note, teamSide, playerId },
    }),
  clockCommand: (
    id: string,
    expectedVersion: number,
    action: string,
    reason?: string,
  ) =>
    req(`/gameday/matches/${id}/clock`, {
      method: "POST",
      body: { expectedVersion, action, reason },
    }),
  changePosition: (
    id: string,
    expectedVersion: number,
    playerId: string,
    position: string | null,
    reason: string,
  ) =>
    req(`/gameday/matches/${id}/lineup`, {
      method: "POST",
      body: { expectedVersion, playerId, position, reason },
    }),
  recordStatistic: (
    id: string,
    expectedVersion: number,
    playerId: string,
    statisticType:
      | "goal_attempt"
      | "intercept"
      | "gain"
      | "turnover"
      | "deflection"
      | "rebound"
      | "penalty",
  ) =>
    req(`/gameday/matches/${id}/statistics`, {
      method: "POST",
      body: { expectedVersion, playerId, statisticType },
    }),
  confirmResult: (
    id: string,
    expectedVersion: number,
    confirmationNote: string,
  ) =>
    req(`/gameday/matches/${id}/result/confirm`, {
      method: "POST",
      body: { expectedVersion, confirmationNote },
    }),

  // Media (blob -> object URL; an <img> can't carry the session cookie header)
  blobUrl: async (path: string): Promise<string | null> => {
    const res = await fetch(`${BASE}${path}`, { credentials: "include" });
    if (!res.ok) return null;
    return URL.createObjectURL(await res.blob());
  },
};
