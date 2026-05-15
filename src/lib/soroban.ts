/**
 * Thin wrappers around @stellar/stellar-sdk for the three StellarShield contracts.
 * All amounts are in stroops (bigint) at this layer; convert at the UI boundary.
 */
import {
  Contract,
  Networks,
  SorobanRpc,
  TransactionBuilder,
  BASE_FEE,
  nativeToScVal,
  Address,
  xdr,
} from "@stellar/stellar-sdk";
import { CONTRACT_IDS, NETWORK_PASSPHRASE, SOROBAN_RPC_URL } from "./constants";

export const rpc = new SorobanRpc.Server(SOROBAN_RPC_URL, { allowHttp: false });

const networkPassphrase = NETWORK_PASSPHRASE;

// ── helpers ──────────────────────────────────────────────────────────────────

async function simulate(tx: ReturnType<TransactionBuilder["build"]>) {
  const sim = await rpc.simulateTransaction(tx);
  if (SorobanRpc.Api.isSimulationError(sim)) throw new Error(sim.error);
  return sim;
}

function buildTx(sourceAccount: Parameters<typeof TransactionBuilder>[0]) {
  return new TransactionBuilder(sourceAccount, {
    fee: BASE_FEE,
    networkPassphrase,
  }).setTimeout(30);
}

// ── GuardContract ─────────────────────────────────────────────────────────────

const guard = new Contract(CONTRACT_IDS.guard);

/** Simulate set_limit — returns the assembled tx for wallet signing */
export async function buildSetLimit(
  sourceAccount: Parameters<typeof TransactionBuilder>[0],
  user: string,
  limitStroops: bigint
) {
  const tx = buildTx(sourceAccount)
    .addOperation(
      guard.call(
        "set_limit",
        new Address(user).toScVal(),
        nativeToScVal(limitStroops, { type: "i128" })
      )
    )
    .build();
  const sim = await simulate(tx);
  return SorobanRpc.assembleTransaction(tx, sim).build();
}

/** Simulate execute_transfer — returns the assembled tx for wallet signing */
export async function buildExecuteTransfer(
  sourceAccount: Parameters<typeof TransactionBuilder>[0],
  user: string,
  to: string,
  amountStroops: bigint
) {
  const tx = buildTx(sourceAccount)
    .addOperation(
      guard.call(
        "execute_transfer",
        new Address(user).toScVal(),
        new Address(to).toScVal(),
        nativeToScVal(amountStroops, { type: "i128" })
      )
    )
    .build();
  const sim = await simulate(tx);
  return SorobanRpc.assembleTransaction(tx, sim).build();
}

// ── RegistryContract ──────────────────────────────────────────────────────────

const registry = new Contract(CONTRACT_IDS.registry);

export async function isTrustedDrip(address: string): Promise<boolean> {
  const account = await rpc.getAccount(address);
  const tx = buildTx(account)
    .addOperation(
      registry.call("is_trusted_drip", new Address(address).toScVal())
    )
    .build();
  const sim = await rpc.simulateTransaction(tx);
  if (SorobanRpc.Api.isSimulationError(sim)) return false;
  const result = (sim as SorobanRpc.Api.SimulateTransactionSuccessResponse)
    .result?.retval;
  return result ? xdr.ScVal.fromXDR(result.toXDR()).b() : false;
}

// ── AuthContract ──────────────────────────────────────────────────────────────

const auth = new Contract(CONTRACT_IDS.auth);

/** Build register_key tx — pubkey is 65-byte uncompressed SEC1 point */
export async function buildRegisterKey(
  sourceAccount: Parameters<typeof TransactionBuilder>[0],
  user: string,
  pubkey: Uint8Array
) {
  const tx = buildTx(sourceAccount)
    .addOperation(
      auth.call(
        "register_key",
        new Address(user).toScVal(),
        nativeToScVal(pubkey, { type: "bytes" })
      )
    )
    .build();
  const sim = await simulate(tx);
  return SorobanRpc.assembleTransaction(tx, sim).build();
}
