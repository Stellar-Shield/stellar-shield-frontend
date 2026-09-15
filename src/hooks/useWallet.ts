"use client";
import { useCallback, useState } from "react";
import {
  isConnected,
  requestAccess,
  signTransaction,
} from "@stellar/freighter-api";

import { NETWORK_PASSPHRASE } from "@/lib/constants";

export interface WalletState {
  publicKey: string | null;
  connected: boolean;
  connecting: boolean;
  error: string | null;
  connect: () => Promise<void>;
  sign: (xdr: string) => Promise<string>;
}

/**
 * Freighter, version 4.
 *
 * This file used to import `getPublicKey`, which version 4 does not export, and
 * treat `isConnected()` as a boolean when it returns `{ isConnected, error }` --
 * so the truthy object meant the "not installed" branch was unreachable and the
 * real failure surfaced later as undefined. Both are fixed here, and every call
 * now checks the `error` field the API actually returns.
 */
export function useWallet(): WalletState {
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connect = useCallback(async () => {
    setConnecting(true);
    setError(null);
    try {
      const present = await isConnected();
      if (present.error) throw new Error(present.error);
      if (!present.isConnected) {
        throw new Error("Freighter is not installed in this browser.");
      }

      // requestAccess prompts the user; getAddress alone returns nothing until
      // the site has been allowed.
      const access = await requestAccess();
      if (access.error) throw new Error(access.error);
      if (!access.address) throw new Error("Freighter returned no address.");

      setPublicKey(access.address);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      throw e;
    } finally {
      setConnecting(false);
    }
  }, []);

  const sign = useCallback(
    async (xdr: string) => {
      if (!publicKey) throw new Error("Connect a wallet first.");
      const signed = await signTransaction(xdr, {
        networkPassphrase: NETWORK_PASSPHRASE,
        address: publicKey,
      });
      if (signed.error) throw new Error(String(signed.error));
      return signed.signedTxXdr;
    },
    [publicKey],
  );

  return {
    publicKey,
    connected: !!publicKey,
    connecting,
    error,
    connect,
    sign,
  };
}
