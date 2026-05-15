"use client";
/**
 * AuthModal — biometric prompt for high-value actions.
 * Calls usePasskey().assert() and forwards the compact signature to the caller.
 */
import { useState } from "react";
import { usePasskey } from "@/hooks/usePasskey";

interface Props {
  userId: string;
  onSuccess: (compactSig: string, message: string) => void;
  onClose: () => void;
}

export default function AuthModal({ userId, onSuccess, onClose }: Props) {
  const { assert } = usePasskey(userId);
  const [status, setStatus] = useState<"idle" | "pending" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handleAuth = async () => {
    setStatus("pending");
    setErrorMsg("");
    try {
      const { compactSig, message } = await assert();
      onSuccess(compactSig, message);
    } catch (e: unknown) {
      setStatus("error");
      setErrorMsg(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Biometric authentication"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
      }}
    >
      <div
        style={{
          background: "#0f172a",
          border: "1px solid #1e293b",
          borderRadius: 12,
          padding: 32,
          width: 320,
          textAlign: "center",
        }}
      >
        <p style={{ color: "#f1f5f9", fontSize: 18, marginBottom: 8 }}>🔐 Verify Identity</p>
        <p style={{ color: "#94a3b8", fontSize: 13, marginBottom: 24 }}>
          Use your passkey (Face ID / fingerprint) to authorise this action.
        </p>

        {status === "error" && (
          <p style={{ color: "#ef4444", fontSize: 12, marginBottom: 12 }}>{errorMsg}</p>
        )}

        <button
          onClick={handleAuth}
          disabled={status === "pending"}
          style={{
            width: "100%",
            padding: "10px 0",
            background: "#6366f1",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            cursor: status === "pending" ? "not-allowed" : "pointer",
            marginBottom: 8,
          }}
        >
          {status === "pending" ? "Waiting for passkey…" : "Authenticate"}
        </button>

        <button
          onClick={onClose}
          style={{
            width: "100%",
            padding: "8px 0",
            background: "transparent",
            color: "#64748b",
            border: "1px solid #1e293b",
            borderRadius: 8,
            cursor: "pointer",
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
