/**
 * Typed client for stellar-shield-backend.
 *
 * Every call goes through the Next.js /api/backend proxy so BACKEND_URL stays
 * server-side.
 *
 * This file and the backend's routes disagreed on every single endpoint: the
 * method (GET vs POST), the field names (signedXdr vs xdr), the request shape
 * (an opaque assertion blob vs a DER signature) and the response shape
 * (compactSig vs compactSignature). Nothing here could ever have reached
 * anything there. The names below are now the ones the backend actually
 * implements, and API.md in both repos records them.
 */

const BASE = "/api/backend";

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    let detail = await res.text();
    try {
      detail = (JSON.parse(detail) as { error?: string }).error ?? detail;
    } catch {
      // not JSON; the raw body is the best message available
    }
    throw new Error(detail || `Backend error ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// -- Passkey / WebAuthn -------------------------------------------------------

export interface ChallengeResponse {
  /** base64url, 32 random bytes */
  challenge: string;
}

/** POST, not GET: issuing a challenge writes one to Redis against this user. */
export const getChallenge = (userId: string): Promise<ChallengeResponse> =>
  req("/auth/challenge", { method: "POST", body: JSON.stringify({ userId }) });

export interface VerifyPayload {
  userId: string;
  /** hex, ASN.1 DER as WebAuthn produces it */
  derSignature: string;
  /** hex, COSE_Key CBOR, only when registering */
  cosePublicKey?: string;
}

export interface VerifyResponse {
  challenge: string;
  /** hex, 64 bytes of r||s, ready for AuthContract::verify_sig */
  compactSignature: string;
  /** hex, 65 bytes uncompressed SEC1, ready for AuthContract::register_key */
  uncompressedPublicKey?: string;
}

export const verifyAssertion = (payload: VerifyPayload): Promise<VerifyResponse> =>
  req("/auth/verify", { method: "POST", body: JSON.stringify(payload) });

// -- Contract state -----------------------------------------------------------

export interface VelocityState {
  /** null means no limit set, which is not the same as a limit of zero. */
  limitStroops: string | null;
  spentStroops: string;
  limitXlm: string | null;
  spentXlm: string;
  remainingXlm: string | null;
  guarded: boolean;
}

export const getVelocity = (user: string): Promise<VelocityState> =>
  req(`/guard/velocity?user=${encodeURIComponent(user)}`);

export interface DripStatus {
  address: string;
  trusted: boolean;
}

/**
 * Whether one address is exempt from the velocity cap.
 *
 * There is no "list all drips" call, because the registry contract stores a
 * flag per address and Soroban has no way to enumerate storage. The old client
 * asked for a list and got a single record back. Asking about one address at a
 * time is what the contract can actually answer.
 */
export const checkDrip = (address: string): Promise<DripStatus> =>
  req(`/registry/drips?address=${encodeURIComponent(address)}`);

// -- Transaction relay --------------------------------------------------------

export interface RelayResponse {
  success: boolean;
  result: { hash?: string; status?: string } & Record<string, unknown>;
}

export const relayTransaction = (signedXdr: string): Promise<RelayResponse> =>
  req("/tx/relay", { method: "POST", body: JSON.stringify({ xdr: signedXdr }) });
