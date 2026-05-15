// Shared constants — keep in sync with the Soroban contracts
export const STROOPS_PER_XLM = 10_000_000n;
export const LEDGERS_PER_DAY = 17_280;
export const TEMP_TTL_LEDGERS = 34_560; // 2 days

export const SOROBAN_RPC_URL =
  process.env.NEXT_PUBLIC_SOROBAN_RPC_URL ?? "https://soroban-testnet.stellar.org";

export const HORIZON_URL =
  process.env.NEXT_PUBLIC_HORIZON_URL ?? "https://horizon-testnet.stellar.org";

export const NETWORK_PASSPHRASE =
  process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE ?? "Test SDF Network ; September 2015";

export const CONTRACT_IDS = {
  guard: process.env.NEXT_PUBLIC_GUARD_CONTRACT_ID ?? "",
  registry: process.env.NEXT_PUBLIC_REGISTRY_CONTRACT_ID ?? "",
  auth: process.env.NEXT_PUBLIC_AUTH_CONTRACT_ID ?? "",
} as const;

/** Convert XLM (number) → stroops (bigint) */
export const toStroops = (xlm: number): bigint =>
  BigInt(Math.round(xlm * Number(STROOPS_PER_XLM)));

/** Convert stroops (bigint) → XLM (number) */
export const fromStroops = (stroops: bigint): number =>
  Number(stroops) / Number(STROOPS_PER_XLM);
