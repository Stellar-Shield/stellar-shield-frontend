"use client";
/**
 * DripList — shows whitelisted drip addresses that bypass the velocity cap.
 * Trusted drips are fetched from the backend (which reads RegistryContract).
 */
import { useEffect, useState } from "react";
import { getDrips, type DripAddress } from "@/lib/api";

export default function DripList() {
  const [drips, setDrips] = useState<DripAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getDrips()
      .then(setDrips)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p style={{ color: "#94a3b8" }}>Loading drip addresses…</p>;
  if (error) return <p style={{ color: "#ef4444" }}>Error: {error}</p>;
  if (drips.length === 0) return <p style={{ color: "#94a3b8" }}>No trusted drip addresses.</p>;

  return (
    <section aria-label="Trusted drip addresses">
      <h2 style={{ color: "#f1f5f9", fontSize: 16, marginBottom: 8 }}>Trusted Drips</h2>
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {drips.map(({ address, label }) => (
          <li
            key={address}
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "6px 0",
              borderBottom: "1px solid #1e293b",
              color: "#cbd5e1",
              fontSize: 13,
              fontFamily: "monospace",
            }}
          >
            <span title={address}>
              {address.slice(0, 6)}…{address.slice(-6)}
            </span>
            {label && <span style={{ color: "#94a3b8" }}>{label}</span>}
            <span
              style={{
                fontSize: 10,
                color: "#22c55e",
                background: "#14532d",
                borderRadius: 4,
                padding: "1px 6px",
              }}
            >
              bypasses cap
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
