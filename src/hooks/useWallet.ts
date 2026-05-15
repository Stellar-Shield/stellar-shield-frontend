"use client";
import { useState, useCallback } from "react";
import {
  isConnected,
  getPublicKey,
  signTransaction,
} from "@stellar/freighter-api";

export interface WalletState {
  publicKey: string | null;
  connected: boolean;
  connect: () => Promise<void>;
  sign: (xdr: string) => Promise<string>;
}

export function useWallet(): WalletState {
  const [publicKey, setPublicKey] = useState<string | null>(null);

  const connect = useCallback(async () => {
    const connected = await isConnected();
    if (!connected) throw new Error("Freighter not installed");
    const key = await getPublicKey();
    setPublicKey(key);
  }, []);

  const sign = useCallback(
    async (xdr: string) => {
      if (!publicKey) throw new Error("Wallet not connected");
      const { signedTxXdr } = await signTransaction(xdr, {
        networkPassphrase: process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE,
      });
      return signedTxXdr;
    },
    [publicKey]
  );

  return { publicKey, connected: !!publicKey, connect, sign };
}
