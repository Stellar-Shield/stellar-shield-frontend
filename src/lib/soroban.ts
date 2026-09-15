/**
 * Thin wrappers around @stellar/stellar-sdk for the three StellarShield
 * contracts. Amounts are stroops (bigint) at this layer; convert at the UI edge.
 */
import {
  Account,
  Address,
  BASE_FEE,
  Contract,
  rpc as sorobanRpc,
  TransactionBuilder,
  nativeToScVal,
  scValToNative,
} from "@stellar/stellar-sdk";

import { NETWORK_PASSPHRASE, SOROBAN_RPC_URL, contractId } from "./constants";

export const rpc = new sorobanRpc.Server(SOROBAN_RPC_URL, { allowHttp: false });

/** The source account a transaction is built on. */
export type Source = Account;

// -- helpers ------------------------------------------------------------------

function buildTx(source: Source) {
  return new TransactionBuilder(source, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  }).setTimeout(30);
}

async function simulate(tx: ReturnType<ReturnType<typeof buildTx>["build"]>) {
  const sim = await rpc.simulateTransaction(tx);
  if (sorobanRpc.Api.isSimulationError(sim)) throw new Error(sim.error);
  return sim;
}

/**
 * Contracts are built on demand, not at module scope.
 *
 * `new Contract("")` throws, and at module scope that throw happened during
 * import -- so with the env vars unset the dashboard died on load with a stack
 * trace about an invalid contract id, instead of telling anyone what to set.
 */
const guard = () => new Contract(contractId("guard"));
const registry = () => new Contract(contractId("registry"));
const auth = () => new Contract(contractId("auth"));

async function assemble(tx: ReturnType<ReturnType<typeof buildTx>["build"]>) {
  const sim = await simulate(tx);
  return sorobanRpc.assembleTransaction(tx, sim).build();
}

/** Simulate a read-only call and return its native value. */
async function read<T>(source: Source, op: ReturnType<Contract["call"]>, fallback: T): Promise<T> {
  const tx = buildTx(source).addOperation(op).build();
  const sim = await rpc.simulateTransaction(tx);
  if (sorobanRpc.Api.isSimulationError(sim)) return fallback;
  const retval = (sim as sorobanRpc.Api.SimulateTransactionSuccessResponse).result?.retval;
  return retval ? (scValToNative(retval) as T) : fallback;
}

// -- GuardContract ------------------------------------------------------------

export async function buildSetLimit(source: Source, user: string, limitStroops: bigint) {
  return assemble(
    buildTx(source)
      .addOperation(
        guard().call(
          "set_limit",
          new Address(user).toScVal(),
          nativeToScVal(limitStroops, { type: "i128" }),
        ),
      )
      .build(),
  );
}

/**
 * The guard takes the registry address explicitly.
 *
 * It used to read its own storage for a whitelist that only the registry
 * contract ever wrote, so no exemption ever applied. Passing the address also
 * means a deployment cannot be quietly pointed at a registry nobody audited.
 */
export async function buildExecuteTransfer(
  source: Source,
  user: string,
  to: string,
  amountStroops: bigint,
) {
  return assemble(
    buildTx(source)
      .addOperation(
        guard().call(
          "execute_transfer",
          new Address(user).toScVal(),
          new Address(contractId("registry")).toScVal(),
          new Address(to).toScVal(),
          nativeToScVal(amountStroops, { type: "i128" }),
        ),
      )
      .build(),
  );
}

export async function getLimit(source: Source, user: string): Promise<bigint | null> {
  return read<bigint | null>(
    source,
    guard().call("limit_of", new Address(user).toScVal()),
    null,
  );
}

export async function getSpentToday(source: Source, user: string): Promise<bigint> {
  return read<bigint>(source, guard().call("spent_today", new Address(user).toScVal()), 0n);
}

// -- RegistryContract ---------------------------------------------------------

export async function isTrustedDrip(source: Source, address: string): Promise<boolean> {
  return read<boolean>(
    source,
    registry().call("is_trusted_drip", new Address(address).toScVal()),
    false,
  );
}

// -- AuthContract -------------------------------------------------------------

/** pubkey is the 65-byte uncompressed SEC1 point. */
export async function buildRegisterKey(source: Source, user: string, pubkey: Uint8Array) {
  if (pubkey.length !== 65) {
    throw new Error(`A P-256 public key is 65 bytes uncompressed, got ${pubkey.length}`);
  }
  return assemble(
    buildTx(source)
      .addOperation(
        auth().call(
          "register_key",
          new Address(user).toScVal(),
          nativeToScVal(Buffer.from(pubkey), { type: "bytes" }),
        ),
      )
      .build(),
  );
}

export async function hasKey(source: Source, user: string): Promise<boolean> {
  return read<boolean>(source, auth().call("has_key", new Address(user).toScVal()), false);
}
