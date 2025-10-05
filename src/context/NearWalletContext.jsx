"use client";

import { NearConnector } from "@hot-labs/near-connect";
import { logger } from "@/utils/logger";
import { NEAR_TREASURY_CONFIG } from "@/constants/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

const NearWalletContext = createContext(null);

export const NearWalletProvider = ({ children }) => {
  const [connector, setConnector] = useState(null);
  const [accountId, setAccountId] = useState(null);

  const init = useCallback(async () => {
    if (connector) {
      return connector;
    }

    let newConnector = null;

    try {
      newConnector = new NearConnector({
        network: "mainnet",
        walletConnect: {
          projectId: "near-treasury",
          metadata: {
            name: NEAR_TREASURY_CONFIG.brandName,
            description: NEAR_TREASURY_CONFIG.brandDescription,
            url: NEAR_TREASURY_CONFIG.brandUrl,
            icons: [NEAR_TREASURY_CONFIG.brandLogo],
          },
        },
      });
    } catch (err) {
      logger.error(err);
      return;
    }

    newConnector.on("wallet:signOut", () => setAccountId(null));
    newConnector.on("wallet:signIn", (t) => {
      setAccountId(t.accounts?.[0]?.accountId ?? null);
    });

    setConnector(newConnector);

    try {
      const wallet = await newConnector.wallet();
      const accountId = await wallet.getAddress();
      if (accountId) {
        setAccountId(accountId);
      }
    } catch {} // No existing wallet connection found

    return newConnector;
  }, [connector]);

  useEffect(() => {
    init();
  }, [init]);

  const connect = useCallback(async () => {
    const newConnector = connector ?? (await init());
    if (newConnector) {
      await newConnector.connect();
    }
  }, [connector, init]);

  const disconnect = useCallback(async () => {
    if (!connector) return;
    await connector.disconnect();
  }, [connector]);

  const signMessage = useCallback(
    async (message) => {
      if (!connector) {
        throw new Error("Connector not initialized");
      }
      const wallet = await connector.wallet();
      const signatureData = await wallet.signMessage(message);
      return { signatureData, signedData: message };
    },
    [connector]
  );

  const signAndSendTransactions = useCallback(
    async (params) => {
      if (!connector) {
        throw new Error("Connector not initialized");
      }
      const wallet = await connector.wallet();
      return wallet.signAndSendTransactions(params);
    },
    [connector]
  );

  const value = useMemo(() => {
    return {
      connector,
      accountId,
      connect,
      disconnect,
      signMessage,
      signAndSendTransactions,
    };
  }, [
    connector,
    accountId,
    connect,
    disconnect,
    signMessage,
    signAndSendTransactions,
  ]);

  return (
    <NearWalletContext.Provider value={value}>
      {children}
    </NearWalletContext.Provider>
  );
};

export function useNearWallet() {
  const ctx = useContext(NearWalletContext);
  if (!ctx) {
    throw new Error("useNearWallet must be used within a NearWalletProvider");
  }
  return ctx;
}
