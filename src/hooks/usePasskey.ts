"use client";
import { useCallback } from "react";
import { getChallenge, verifyAssertion } from "@/lib/api";

/**
 * WebAuthn passkey helpers.
 * Registration sends the 65-byte uncompressed public key to AuthContract::register_key.
 * Assertion returns a compact r||s signature ready for AuthContract::verify_sig.
 */
export function usePasskey(userId: string) {
  /** Register a new passkey — returns the raw 65-byte pubkey (Uint8Array) */
  const register = useCallback(async (): Promise<Uint8Array> => {
    const { challenge } = await getChallenge(userId);
    const challengeBytes = Uint8Array.from(atob(challenge), (c) => c.charCodeAt(0));

    const credential = await navigator.credentials.create({
      publicKey: {
        challenge: challengeBytes,
        rp: { name: "StellarShield" },
        user: {
          id: new TextEncoder().encode(userId),
          name: userId,
          displayName: "StellarShield User",
        },
        pubKeyCredParams: [{ alg: -7, type: "public-key" }], // ES256 = P-256
        timeout: 60_000,
        attestation: "none",
      },
    }) as PublicKeyCredential | null;

    if (!credential) throw new Error("Passkey registration cancelled");

    const response = credential.response as AuthenticatorAttestationResponse;
    // Extract the raw 65-byte uncompressed public key from CBOR attestation
    const pubkeyBuffer = response.getPublicKey();
    if (!pubkeyBuffer) throw new Error("Could not extract public key");

    // SubtleCrypto exports SPKI; the last 65 bytes are the uncompressed EC point
    const spki = new Uint8Array(pubkeyBuffer);
    return spki.slice(-65);
  }, [userId]);

  /** Assert (sign) — returns { compactSig, message } for AuthContract::verify_sig */
  const assert = useCallback(async () => {
    const { challenge, sessionId } = await getChallenge(userId);
    const challengeBytes = Uint8Array.from(atob(challenge), (c) => c.charCodeAt(0));

    const assertion = await navigator.credentials.get({
      publicKey: { challenge: challengeBytes, timeout: 60_000 },
    }) as PublicKeyCredential | null;

    if (!assertion) throw new Error("Passkey assertion cancelled");

    return verifyAssertion({ sessionId, assertion: assertion.toJSON() });
  }, [userId]);

  return { register, assert };
}
