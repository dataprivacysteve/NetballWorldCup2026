import type {
  OfflineGateBundle,
  OfflineScanEvent,
  ScanResult,
} from "./api";

const BUNDLE_KEY = "gameday.offline-gate.bundle.v1";
const QUEUE_KEY = "gameday.offline-gate.queue.v1";

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const value = window.localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function getOfflineBundle() {
  return read<OfflineGateBundle | null>(BUNDLE_KEY, null);
}

export function saveOfflineBundle(bundle: OfflineGateBundle) {
  write(BUNDLE_KEY, bundle);
}

export function getOfflineQueue() {
  return read<OfflineScanEvent[]>(QUEUE_KEY, []);
}

export function removeSyncedOfflineEvents(clientEventIds: string[]) {
  const accepted = new Set(clientEventIds);
  write(
    QUEUE_KEY,
    getOfflineQueue().filter((event) => !accepted.has(event.clientEventId)),
  );
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await window.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export async function verifyOffline(token: string): Promise<{
  result: ScanResult;
  bundleExpired: boolean;
}> {
  const bundle = getOfflineBundle();
  if (!bundle) {
    return {
      result: { valid: false, reason: "No offline credential pack is installed" },
      bundleExpired: true,
    };
  }
  if (new Date(bundle.expiresAt).getTime() <= Date.now()) {
    return {
      result: { valid: false, reason: "Offline credential pack has expired" },
      bundleExpired: true,
    };
  }
  const tokenHash = await sha256(token);
  const credential = bundle.credentials.find(
    (candidate) => candidate.tokenHash === tokenHash,
  );
  let result: ScanResult;
  if (!credential) {
    result = { valid: false, reason: "Credential is not in the offline pack" };
  } else if (credential.status !== "issued") {
    result = { valid: false, reason: "Credential has been revoked" };
  } else {
    result = {
      valid: true,
      credentialId: credential.id,
      person: {
        id: credential.id,
        firstName: credential.firstName,
        lastName: credential.lastName,
        category: credential.category,
        role: credential.role,
      },
      delegation: {
        name: credential.delegationName,
        countryCode: credential.countryCode,
      },
    };
  }
  const queued: OfflineScanEvent = {
    clientEventId: window.crypto.randomUUID(),
    token,
    scannedAt: new Date().toISOString(),
    offlineValid: result.valid,
    offlineReason: result.valid ? undefined : result.reason,
  };
  write(QUEUE_KEY, [...getOfflineQueue(), queued]);
  return { result, bundleExpired: false };
}
