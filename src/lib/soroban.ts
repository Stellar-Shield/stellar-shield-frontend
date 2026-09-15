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

/**
 * A source account for a read.
 *
 * Simulation never submits, so the sequence number is not consulted and this
 * does not need a network round trip. It exists so a read does not require the
 * caller to have fetched an account first -- and so reading someone else's
 * limit does not require their account at all.
 */
export const readSource = (address: string): Source => new Account(address, "0");

/**
 * Simulate a read-only call and return its native value.
 *
 * A simulation error is raised, not swallowed. The previous version returned a
 * fallback, which meant an RPC outage read as `limit_of -> null` -- and null
 * means "no limit set", so a network problem displayed as an unguarded account.
 * That is the same fail-open the contract and the backend both had. An absent
 * value is still a legitimate answer; a failure to ask is not.
 */
async function read<T>(source: Source, op: ReturnType<Contract["call"]>, absent: T): Promise<T> {
  const tx = buildTx(source).addOperation(op).build();
  const sim = await rpc.simulateTransaction(tx);
  if (sorobanRpc.Api.isSimulationError(sim)) {
    throw new Error(`Soroban RPC could not answer: ${sim.error}`);
  }
  const retval = (sim as sorobanRpc.Api.SimulateTransactionSuccessResponse).result?.retval;
  return retval ? (scValToNative(retval) as T) : absent;
}

/**
 * Submit a signed transaction to Soroban RPC and wait for it to land.
 *
 * This used to be POSTed to our own backend, which forwarded it to the same
 * public RPC. There is nothing a server can add here: the transaction is
 * already signed, the RPC is public and sends CORS headers, and routing it
 * through a server only adds something that can be down, and someone who could
 * drop the transaction on the floor. The browser talks to the network.
 */
export async function submit(signedXdr: string): Promise<{ hash: string; status: string }> {
  const tx = TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE);
  const sent = await rpc.sendTransaction(tx);

  if (sent.status !== "PENDING") {
    // errorResult carries the reason the network refused it outright.
    const why = sent.errorResult ? `: ${sent.errorResult.result().switch().name}` : "";
    throw new Error(`The network refused the transaction (${sent.status})${why}`);
  }

  const deadline = Date.now() + 40_000;
  let got = await rpc.getTransaction(sent.hash);
  while (got.status === sorobanRpc.Api.GetTransactionStatus.NOT_FOUND && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 1500));
    got = await rpc.getTransaction(sent.hash);
  }

  if (got.status === sorobanRpc.Api.GetTransactionStatus.NOT_FOUND) {
    throw new Error(`Transaction ${sent.hash} was accepted but has not landed yet.`);
  }
  if (got.status !== sorobanRpc.Api.GetTransactionStatus.SUCCESS) {
    throw new Error(`Transaction ${sent.hash} failed on chain (${got.status}).`);
  }
  return { hash: sent.hash, status: got.status };
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
