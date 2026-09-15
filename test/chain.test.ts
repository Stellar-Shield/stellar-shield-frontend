import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

/**
 * The read path must not fail open, and the submit path must not report
 * success before the network agrees.
 *
 * These are the two places where a network problem could be mistaken for a
 * good answer: a failed simulation that reads as "this account has no limit",
 * and a submitted transaction reported as done before it lands. Both were real
 * in the old code, so both get a test.
 */

const passphrase = "Test SDF Network ; September 2015";

vi.mock("@stellar/stellar-sdk", async () => {
  const actual = await vi.importActual<typeof import("@stellar/stellar-sdk")>(
    "@stellar/stellar-sdk",
  );
  return {
    ...actual,
    rpc: {
      ...actual.rpc,
      Server: class {
        simulateTransaction = vi.fn(async () => globalThis.__sim);
        sendTransaction = vi.fn(async () => globalThis.__sent);
        getTransaction = vi.fn(async () => globalThis.__got.shift() ?? globalThis.__gotLast);
        getAccount = vi.fn();
      },
    },
  };
});

declare global {
  // eslint-disable-next-line no-var
  var __sim: unknown;
  // eslint-disable-next-line no-var
  var __sent: unknown;
  // eslint-disable-next-line no-var
  var __got: unknown[];
  // eslint-disable-next-line no-var
  var __gotLast: unknown;
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_GUARD_CONTRACT_ID =
    "CDHAOCU3SQ5FJK3K2TT76T74V7SYEQUN6GU2EXX3A7BZR7XYVPYUMB5T";
  process.env.NEXT_PUBLIC_REGISTRY_CONTRACT_ID =
    "CAWXVQKWWGP62YNYQIQ6AYAPP7EYNPCUT4MB3LDSCEVWLSQRGYYP45AK";
  process.env.NEXT_PUBLIC_AUTH_CONTRACT_ID =
    "CDRIB5FDB34NORXUP7SIVU3OF6BKKFBRVJLS23QFNWPTMG7QH3DYGMPL";
  globalThis.__got = [];
});

afterEach(() => {
  vi.resetModules();
});

const USER = "GDTL6PQJ2NVDW3HVTFIOBVXIWHCKSOEPWWSYT67QVKJLNFDOWNGCJ3U6";

describe("reads do not fail open", () => {
  it("raises when the simulation errors instead of reporting no limit", async () => {
    globalThis.__sim = { error: "host invocation failed" };
    const { getLimit, readSource } = await import("../src/lib/soroban");

    // The old code returned the `null` fallback here, and null means "this
    // account is unguarded" to every caller. A network failure would have
    // rendered as an open account.
    await expect(getLimit(readSource(USER), USER)).rejects.toThrow(/could not answer/i);
  });
});

describe("submit", () => {
  it("refuses to claim success when the network rejects the envelope", async () => {
    globalThis.__sent = { status: "ERROR", hash: "abc" };
    const { submit } = await import("../src/lib/soroban");
    await expect(submit(fakeXdr())).rejects.toThrow(/refused/i);
  });

  it("raises when the transaction lands but failed on chain", async () => {
    globalThis.__sent = { status: "PENDING", hash: "deadbeef" };
    globalThis.__gotLast = { status: "FAILED" };
    const { submit } = await import("../src/lib/soroban");
    await expect(submit(fakeXdr())).rejects.toThrow(/failed on chain/i);
  });

  it("returns the hash once the transaction has actually landed", async () => {
    globalThis.__sent = { status: "PENDING", hash: "cafe" };
    globalThis.__gotLast = { status: "SUCCESS" };
    const { submit } = await import("../src/lib/soroban");
    await expect(submit(fakeXdr())).resolves.toEqual({ hash: "cafe", status: "SUCCESS" });
  });
});

/** A real, parseable envelope — submit() decodes before it does anything else. */
function fakeXdr(): string {
  // Built once with the SDK so the test exercises the real parser rather than a
  // string the code is trusted not to look at.
  return xdrFixture;
}

const xdrFixture = (() => {
  const {
    Account,
    BASE_FEE,
    Operation,
    TransactionBuilder,
    Asset,
  } = require("@stellar/stellar-sdk") as typeof import("@stellar/stellar-sdk");
  const tx = new TransactionBuilder(new Account(USER, "0"), {
    fee: BASE_FEE,
    networkPassphrase: passphrase,
  })
    .addOperation(Operation.payment({ destination: USER, asset: Asset.native(), amount: "1" }))
    .setTimeout(30)
    .build();
  return tx.toXDR();
})();
