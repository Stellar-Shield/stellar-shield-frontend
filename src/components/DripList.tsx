"use client";
/**
 * Check whether an address is exempt from the velocity cap.
 *
 * This was a list of trusted drips. It could not have worked: the registry
 * contract stores a boolean per address, and Soroban has no way to enumerate
 * storage keys, so there is nothing to list. The registry answers one address
 * at a time, yes or no. This asks the question the system can actually answer,
 * and asks the contract rather than a server that would ask the contract.
 */
import { useState } from "react";

import { isTrustedDrip, readSource } from "@/lib/soroban";

export default function DripList() {
  const [address, setAddress] = useState("");
  const [result, setResult] = useState<{ address: string; trusted: boolean } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function check() {
    const trimmed = address.trim();
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      // Read the registry directly. The answer is public on-chain state; it
      // does not need a server, and a server here could only be wrong.
      const trusted = await isTrustedDrip(readSource(trimmed), trimmed);
      setResult({ address: trimmed, trusted });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section aria-label="Trusted drip check">
      <h2 style={{ color: "#f1f5f9", fontSize: 16, marginBottom: 8 }}>Trusted drips</h2>
      <p style={{ color: "#94a3b8", fontSize: 12, marginBottom: 8 }}>
        A trusted address bypasses your daily limit entirely. Check one before you rely on it.
      </p>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="G… or C… address"
          aria-label="Address to check"
          style={{
            flex: 1,
            padding: "8px 12px",
            background: "#0f172a",
            border: "1px solid #334155",
            borderRadius: 8,
            color: "#f1f5f9",
            fontSize: 13,
            fontFamily: "monospace",
          }}
        />
        <button
          onClick={check}
          disabled={loading || !address.trim()}
          style={{
            padding: "8px 20px",
            background: "#6366f1",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            cursor: "pointer",
            fontSize: 14,
          }}
        >
          {loading ? "Checking…" : "Check"}
        </button>
      </div>

      {error && (
        <p role="alert" style={{ color: "#ef4444", fontSize: 13, marginTop: 8 }}>
          {error}
        </p>
      )}

      {result && (
        <p
          style={{
            marginTop: 8,
            fontSize: 13,
            color: result.trusted ? "#f59e0b" : "#22c55e",
          }}
        >
          {result.trusted
            ? "Trusted — payments here are NOT capped."
            : "Not trusted — payments here count against your daily limit."}
        </p>
      )}
    </section>
  );
}
