"use client";
import { useEffect, useState } from "react";
import { getVelocity } from "@/lib/api";
import { fromStroops } from "@/lib/constants";

export interface VelocityData {
  limitXlm: number;
  spentXlm: number;
  remainingXlm: number;
  pctUsed: number; // 0–100
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useVelocity(user: string | null): VelocityData {
  const [limitXlm, setLimitXlm] = useState(0);
  const [spentXlm, setSpentXlm] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    setError(null);
    getVelocity(user)
      .then(({ limitStroops, spentStroops }) => {
        setLimitXlm(fromStroops(BigInt(limitStroops)));
        setSpentXlm(fromStroops(BigInt(spentStroops)));
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [user, tick]);

  const remainingXlm = Math.max(0, limitXlm - spentXlm);
  const pctUsed = limitXlm > 0 ? Math.min(100, (spentXlm / limitXlm) * 100) : 0;

  return {
    limitXlm,
    spentXlm,
    remainingXlm,
    pctUsed,
    loading,
    error,
    refresh: () => setTick((t) => t + 1),
  };
}
