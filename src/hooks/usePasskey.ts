"use client";
import { useCallback } from "react";
import { getChallenge, verifyAssertion } from "@/lib/api";

/**
 * The backend issues challenges as base64url. atob() reads standard base64, so
 * any challenge containing - or _ decoded to the wrong bytes and the signature
 * was over something the server never sent.
 */
function fromBase64Url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

const toHex = (u8: Uint8Array): string =>
  [...u8].map((b) => b.toString(16).padStart(2, "0")).join("");

/**
 * WebAuthn passkey helpers.
 * Registration sends the 65-byte uncompressed public key to AuthContract::register_key.
 * Assertion returns a compact r||s signature ready for AuthContract::verify_sig.
 */
export function usePasskey(userId: string) {
  /** Register a new passkey — returns the raw 65-byte pubkey (Uint8Array) */
  const register = useCallback(async (): Promise<Uint8Array> => {
    const { challenge } = await getChallenge(userId);
    const challengeBytes = fromBase64Url(challenge);

    const credential = (await navigator.credentials.create({
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
    })) as PublicKeyCredential | null;

    if (!credential) throw new Error("Passkey registration cancelled");

    const response = credential.response as AuthenticatorAttestationResponse;
    // Extract the raw 65-byte uncompressed public key from CBOR attestation
    const pubkeyBuffer = response.getPublicKey();
    if (!pubkeyBuffer) throw new Error("Could not extract public key");

    // SubtleCrypto exports SPKI; the last 65 bytes are the uncompressed EC point
    const spki = new Uint8Array(pubkeyBuffer);
    return spki.slice(-65);
  }, [userId]);

  /**
   * Assert (sign). Returns the 64-byte compact signature the contract wants.
   *
   * This used to post `assertion.toJSON()` to a `sessionId` the backend never
   * issued. The backend takes the DER signature as hex, so that is what gets
   * extracted and sent.
   */
  const assert = useCallback(async () => {
    const { challenge } = await getChallenge(userId);
    const challengeBytes = fromBase64Url(challenge);

    const assertion = (await navigator.credentials.get({
      publicKey: { challenge: challengeBytes, timeout: 60_000 },
    })) as PublicKeyCredential | null;

    if (!assertion) throw new Error("Passkey assertion cancelled");

    const response = assertion.response as AuthenticatorAssertionResponse;
    return verifyAssertion({
      userId,
      derSignature: toHex(new Uint8Array(response.signature)),
    });
  }, [userId]);

  return { register, assert };
}
