"use client";
import { useState } from "react";
import { useWallet } from "@/hooks/useWallet";
import { useVelocity } from "@/hooks/useVelocity";
import VelocityGauge from "@/components/VelocityGauge";
import DripList from "@/components/DripList";
import AuthModal from "@/components/AuthModal";
import { buildSetLimit, buildExecuteTransfer, rpc } from "@/lib/soroban";
import { toStroops } from "@/lib/constants";
import { relayTransaction } from "@/lib/api";

export default function DashboardPage() {
  const wallet = useWallet();
  const velocity = useVelocity(wallet.publicKey);

  const [showAuth, setShowAuth] = useState(false);
  const [limitInput, setLimitInput] = useState("");
  const [toInput, setToInput] = useState("");
  const [amountInput, setAmountInput] = useState("");
  const [txStatus, setTxStatus] = useState("");

  // ── helpers ────────────────────────────────────────────────────────────────

  async function signAndRelay(xdr: string) {
    const signed = await wallet.sign(xdr);
    const { hash, status } = await relayTransaction({ signedXdr: signed });
    setTxStatus(`${status} — ${hash}`);
    velocity.refresh();
  }

  async function handleSetLimit() {
    if (!wallet.publicKey) return;
    const account = await rpc.getAccount(wallet.publicKey);
    const tx = await buildSetLimit(account, wallet.publicKey, toStroops(Number(limitInput)));
    await signAndRelay(tx.toXDR());
  }

  async function handleTransfer() {
    if (!wallet.publicKey) return;
    const account = await rpc.getAccount(wallet.publicKey);
    const tx = await buildExecuteTransfer(
      account,
      wallet.publicKey,
      toInput,
      toStroops(Number(amountInput))
    );
    await signAndRelay(tx.toXDR());
  }

  // ── render ─────────────────────────────────────────────────────────────────

  if (!wallet.connected) {
    return (
      <main style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 80 }}>
        <h1 style={{ fontSize: 28, marginBottom: 8 }}>🛡 StellarShield</h1>
        <p style={{ color: "#94a3b8", marginBottom: 24 }}>Connect your Freighter wallet to continue.</p>
        <button
          onClick={wallet.connect}
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
          Connect Freighter
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
          <button onClick={handleSetLimit} style={btnStyle}>Set</button>
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
            <button onClick={handleTransfer} style={btnStyle}>Send</button>
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
