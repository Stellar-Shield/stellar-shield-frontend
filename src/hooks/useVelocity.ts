"use client";
import { useCallback, useEffect, useState } from "react";

import { getVelocity } from "@/lib/api";
import { fromStroops, stroopsToApproxXlm } from "@/lib/constants";

export interface VelocityData {
  /** Exact, for display and arithmetic. */
  limitStroops: bigint | null;
  spentStroops: bigint;
  limitXlm: string;
  spentXlm: string;
  remainingXlm: string;
  /** Approximate, and only ever used to size a gauge. */
  pctUsed: number;
  guarded: boolean;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

/**
 * Balances are held as stroops, not as numbers.
 *
 * This hook used to convert straight to a float for display, which is fine for
 * a gauge and wrong for a balance: a double cannot hold every stroop value, so
 * larger amounts stop round-tripping. The only float here is the percentage,
 * which is a bar width and nothing else.
 */
export function useVelocity(user: string | null): VelocityData {
  const [limitStroops, setLimitStroops] = useState<bigint | null>(null);
  const [spentStroops, setSpentStroops] = useState<bigint>(0n);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!user) return;
    let live = true;
    setLoading(true);
    setError(null);
    getVelocity(user)
      .then(({ limitStroops: l, spentStroops: s }) => {
        if (!live) return;
        setLimitStroops(l === null || l === "" ? null : BigInt(l));
        setSpentStroops(BigInt(s || "0"));
      })
      .catch((e: unknown) => {
        if (live) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    // Avoid a slow response for the previous account landing after a switch.
    return () => {
      live = false;
    };
  }, [user, tick]);

  const guarded = limitStroops !== null && limitStroops > 0n;
  const remaining =
    limitStroops !== null && limitStroops > spentStroops ? limitStroops - spentStroops : 0n;

  const pctUsed = guarded
    ? Math.min(100, (stroopsToApproxXlm(spentStroops) / stroopsToApproxXlm(limitStroops!)) * 100)
    : 0;

  return {
    limitStroops,
    spentStroops,
    limitXlm: limitStroops === null ? "—" : fromStroops(limitStroops),
    spentXlm: fromStroops(spentStroops),
    remainingXlm: fromStroops(remaining),
    pctUsed,
    guarded,
    loading,
    error,
    refresh: useCallback(() => setTick((t) => t + 1), []),
  };
}
