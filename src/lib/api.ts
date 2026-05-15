/**
 * Typed client for stellar-shield-backend.
 * All calls go through Next.js /api/* proxy routes so BACKEND_URL stays server-side.
 */

const BASE = "/api/backend";

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) throw new Error(`Backend error ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

// ── Passkey / WebAuthn ────────────────────────────────────────────────────────

export interface ChallengeResponse {
  challenge: string; // base64url
  sessionId: string;
}

export const getChallenge = (userId: string): Promise<ChallengeResponse> =>
  req(`/auth/challenge?userId=${encodeURIComponent(userId)}`);

export interface VerifyAssertionPayload {
  sessionId: string;
  assertion: unknown; // raw WebAuthn AuthenticatorAssertionResponse JSON
}

export interface VerifyAssertionResponse {
  compactSig: string; // hex — r||s (64 bytes), ready for AuthContract::verify_sig
  message: string;    // hex — the signed message
}

export const verifyAssertion = (payload: VerifyAssertionPayload): Promise<VerifyAssertionResponse> =>
  req("/auth/verify", { method: "POST", body: JSON.stringify(payload) });

// ── Contract state (cheap reads, no RPC on every load) ───────────────────────

export interface VelocityState {
  limitStroops: string;  // i128 as string
  spentStroops: string;  // i128 as string
}

export const getVelocity = (user: string): Promise<VelocityState> =>
  req(`/guard/velocity?user=${encodeURIComponent(user)}`);

export interface DripAddress {
  address: string;
  label?: string;
}

export const getDrips = (): Promise<DripAddress[]> => req("/registry/drips");

// ── Transaction relay ─────────────────────────────────────────────────────────

export interface RelayPayload {
  signedXdr: string; // base64-encoded signed transaction envelope
}

export interface RelayResponse {
  hash: string;
  status: "PENDING" | "SUCCESS" | "ERROR";
}

export const relayTransaction = (payload: RelayPayload): Promise<RelayResponse> =>
  req("/tx/relay", { method: "POST", body: JSON.stringify(payload) });
