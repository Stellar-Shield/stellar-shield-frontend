"use client";
import { useState } from "react";
import { useWallet } from "@/hooks/useWallet";
import { useVelocity } from "@/hooks/useVelocity";
import VelocityGauge from "@/components/VelocityGauge";
import DripList from "@/components/DripList";
import AuthModal from "@/components/AuthModal";
import { buildSetLimit, buildExecuteTransfer, rpc, submit } from "@/lib/soroban";
import { contractsConfigured, toStroops } from "@/lib/constants";

export default function DashboardPage() {
  const wallet = useWallet();
  const velocity = useVelocity(wallet.publicKey);

  const [showAuth, setShowAuth] = useState(false);
  const [limitInput, setLimitInput] = useState("");
  const [toInput, setToInput] = useState("");
  const [amountInput, setAmountInput] = useState("");
  const [txStatus, setTxStatus] = useState("");
  const [txError, setTxError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /** Run a chain action, and put the failure on screen instead of the console. */
  async function attempt(what: string, fn: () => Promise<void>) {
    setBusy(true);
    setTxError(null);
    try {
      await fn();
    } catch (e) {
      setTxError(`${what} failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  // ── helpers ────────────────────────────────────────────────────────────────

  /**
   * Sign in the wallet, submit to the network, wait for it to land.
   *
   * The signed envelope used to be POSTed to our backend, which forwarded it to
   * the same public Soroban RPC. It goes straight there now: the transaction is
   * already signed, so a server in the middle adds nothing but something that
   * can be down and someone who could drop it. `submit` waits for the result,
   * so a transaction that fails on chain reports as failed rather than as
   * "Submitted." and a gauge that silently never moves.
   */
  async function signAndSubmit(xdr: string) {
    const signed = await wallet.sign(xdr);
    setTxStatus("Waiting for the network…");
    const { hash, status } = await submit(signed);
    setTxStatus(`${status} — ${hash}`);
    velocity.refresh();
  }

  async function handleSetLimit() {
    if (!wallet.publicKey) return;
    await attempt("Setting the limit", async () => {
      const account = await rpc.getAccount(wallet.publicKey!);
      const tx = await buildSetLimit(account, wallet.publicKey!, toStroops(limitInput));
      await signAndSubmit(tx.toXDR());
    });
  }

  async function handleTransfer() {
    if (!wallet.publicKey) return;
    await attempt("The transfer", async () => {
      const account = await rpc.getAccount(wallet.publicKey!);
      const tx = await buildExecuteTransfer(
        account,
        wallet.publicKey!,
        toInput,
        toStroops(amountInput),
      );
      await signAndSubmit(tx.toXDR());
    });
  }

  // ── render ─────────────────────────────────────────────────────────────────

  if (!wallet.connected) {
    return (
      <main style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 80 }}>
        <h1 style={{ fontSize: 28, marginBottom: 8 }}>🛡 StellarShield</h1>
        <p style={{ color: "#94a3b8", marginBottom: 24 }}>Connect your Freighter wallet to continue.</p>
        {!contractsConfigured() && (
          <p style={{ color: "#f59e0b", fontSize: 13, maxWidth: 420, textAlign: "center", marginBottom: 16 }}>
            The contract ids are not set. Deploy the contracts and put them in
            .env.local, or the dashboard will connect and then fail on every action.
          </p>
        )}
        {wallet.error && (
          <p role="alert" style={{ color: "#ef4444", fontSize: 13, marginBottom: 16 }}>{wallet.error}</p>
        )}
        <button
          disabled={wallet.connecting}
          onClick={() => { void wallet.connect(); }}
          style={{
            padding: "10px 28px",
            background: "#6366f1",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            cursor: "pointer",
            fontSize: 15,
          }}
        >
          {wallet.connecting ? "Connecting…" : "Connect Freighter"}
        </button>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: "32px 16px" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
        <h1 style={{ fontSize: 22, margin: 0 }}>🛡 StellarShield</h1>
        <span style={{ color: "#94a3b8", fontSize: 12, fontFamily: "monospace" }}>
          {wallet.publicKey!.slice(0, 6)}…{wallet.publicKey!.slice(-6)}
        </span>
      </header>

      {/* Velocity gauge */}
      <section style={{ display: "flex", justifyContent: "center", marginBottom: 32 }}>
        <VelocityGauge
          spentXlm={velocity.spentXlm}
          limitXlm={velocity.limitXlm}
          pctUsed={velocity.pctUsed}
          guarded={velocity.guarded}
        />
      </section>

      {/* Set limit */}
      <section style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 15, marginBottom: 8 }}>Set Daily Limit</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            type="number"
            min="0"
            placeholder="XLM"
            value={limitInput}
            onChange={(e) => setLimitInput(e.target.value)}
            style={inputStyle}
            aria-label="Daily limit in XLM"
          />
          <button onClick={handleSetLimit} disabled={busy} style={btnStyle}>Set</button>
        </div>
      </section>

      {/* Execute transfer */}
      <section style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 15, marginBottom: 8 }}>Send XLM</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <input
            type="text"
            placeholder="Recipient address"
            value={toInput}
            onChange={(e) => setToInput(e.target.value)}
            style={inputStyle}
            aria-label="Recipient Stellar address"
          />
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="number"
              min="0"
              placeholder="Amount (XLM)"
              value={amountInput}
              onChange={(e) => setAmountInput(e.target.value)}
              style={inputStyle}
              aria-label="Amount in XLM"
            />
            <button onClick={handleTransfer} disabled={busy} style={btnStyle}>Send</button>
          </div>
        </div>
      </section>

      {/* Passkey auth trigger */}
      <section style={{ marginBottom: 24 }}>
        <button
          onClick={() => setShowAuth(true)}
          style={{ ...btnStyle, background: "#0f172a", border: "1px solid #334155" }}
        >
          🔐 Verify with Passkey
        </button>
      </section>

      {txError && (
        <p role="alert" style={{ color: "#ef4444", fontSize: 13, marginBottom: 16 }}>{txError}</p>
      )}

      {velocity.error && (
        <p role="alert" style={{ color: "#ef4444", fontSize: 13, marginBottom: 16 }}>
          Could not read your limit: {velocity.error}
        </p>
      )}

      {txStatus && (
        <p style={{ color: "#94a3b8", fontSize: 12, fontFamily: "monospace", marginBottom: 24 }}>
          {txStatus}
        </p>
      )}

      <DripList />

      {showAuth && wallet.publicKey && (
        <AuthModal
          userId={wallet.publicKey}
          onSuccess={(sig, msg) => {
            setShowAuth(false);
            setTxStatus(`Passkey verified — sig: ${sig.slice(0, 16)}… msg: ${msg.slice(0, 16)}…`);
          }}
          onClose={() => setShowAuth(false)}
        />
      )}
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  flex: 1,
  padding: "8px 12px",
  background: "#0f172a",
  border: "1px solid #334155",
  borderRadius: 8,
  color: "#f1f5f9",
  fontSize: 14,
};

const btnStyle: React.CSSProperties = {
  padding: "8px 20px",
  background: "#6366f1",
  color: "#fff",
  border: "none",
  borderRadius: 8,
  cursor: "pointer",
  fontSize: 14,
  whiteSpace: "nowrap",
};
