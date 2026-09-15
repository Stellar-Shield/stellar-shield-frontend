// Shared constants. Keep in sync with the Soroban contracts.
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

export type ContractName = keyof typeof CONTRACT_IDS;

/**
 * A contract id, or a message saying which one is missing.
 *
 * These are empty until someone deploys and sets the env vars. Reading them
 * blindly used to mean `new Contract("")` ran at module scope and threw while
 * the page was still importing, so the whole dashboard went white with a stack
 * trace about an invalid contract id rather than saying what was unset.
 */
export function contractId(name: ContractName): string {
  const id = CONTRACT_IDS[name];
  if (!id) {
    throw new Error(
      `NEXT_PUBLIC_${name.toUpperCase()}_CONTRACT_ID is not set. ` +
        `Deploy the contracts and put their ids in .env.local — see README.`,
    );
  }
  return id;
}

export const contractsConfigured = (): boolean =>
  Object.values(CONTRACT_IDS).every((id) => id.length > 0);

/**
 * XLM as written by a person, to stroops, exactly.
 *
 * Not `Math.round(xlm * 10_000_000)`: that goes through a float, and a float
 * cannot hold every stroop amount. 8.13 XLM lands on 81299999.99999999 and
 * rounds back, but larger balances do not come back. Money is parsed as digits.
 */
export function toStroops(xlm: string): bigint {
  const text = String(xlm).trim();
  const m = /^(\d+)(?:\.(\d{1,7}))?$/.exec(text);
  if (!m) {
    throw new Error(`Enter an amount like 2.5 — got "${xlm}"`);
  }
  const whole = BigInt(m[1]);
  const frac = BigInt((m[2] ?? "").padEnd(7, "0"));
  return whole * STROOPS_PER_XLM + frac;
}

/** Stroops to a display string, without inventing precision. */
export function fromStroops(stroops: bigint | string): string {
  const n = BigInt(stroops);
  const whole = n / STROOPS_PER_XLM;
  const frac = (n % STROOPS_PER_XLM).toString().padStart(7, "0");
  return `${whole}.${frac}`.replace(/0+$/, "").replace(/\.$/, "");
}

/** Stroops as a number, for widths and percentages only — never for money. */
export const stroopsToApproxXlm = (stroops: bigint | string): number =>
  Number(BigInt(stroops)) / Number(STROOPS_PER_XLM);
