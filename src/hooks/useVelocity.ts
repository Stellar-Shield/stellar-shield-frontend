"use client";
import { useCallback, useEffect, useState } from "react";

import { fromStroops, stroopsToApproxXlm } from "@/lib/constants";
import { getLimit, getSpentToday, readSource } from "@/lib/soroban";

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
 * The user's cap and today's spend, read from the chain.
 *
 * Two things changed here. Balances are held as stroops rather than floats: a
 * double cannot represent every stroop value, so larger amounts stopped
 * round-tripping. The only float left is the percentage, which is a bar width.
 *
 * And the read goes straight to Soroban RPC. It used to go to our backend,
 * which simulated the same two calls against the same public RPC and handed
 * back the same numbers. The limit lives on chain and anyone can read it; a
 * server in the middle could only be down, or lie.
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

    const source = readSource(user);
    Promise.all([getLimit(source, user), getSpentToday(source, user)])
      .then(([limit, spent]) => {
        if (!live) return;
        setLimitStroops(limit);
        setSpentStroops(spent);
      })
      .catch((e: unknown) => {
        if (!live) return;
        // Show nothing rather than a stale or invented figure. A failed read is
        // not the same as "no limit", and must not render as an open account.
        setLimitStroops(null);
        setSpentStroops(0n);
        setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (live) setLoading(false);
      });

    // Avoid a slow response for the previous account landing after a switch.
    return () => {
      live = false;
    };
  }, [user, tick]);

  const guarded = error === null && limitStroops !== null && limitStroops > 0n;
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
