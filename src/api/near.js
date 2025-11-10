import {
  NearRpcClient,
  viewAccount as viewAccountNear,
  viewFunctionAsJson,
  query,
} from "@near-js/jsonrpc-client";

export const client = new NearRpcClient({
  endpoint: "https://rpc.mainnet.fastnear.com",
  headers: { Authorization: process.env.NEXT_PUBLIC_FASTNEAR_API_KEY || "" },
});

export const Near = {
  view: async (contractId, methodName, args = {}) => {
    try {
      if (!contractId || !methodName) {
        return null;
      }
      const result = await viewFunctionAsJson(client, {
        accountId: contractId,
        methodName: methodName,
        finality: "final",
        argsBase64: Buffer.from(JSON.stringify(args)).toString("base64"),
      });
      return result;
    } catch (error) {
      console.warn(
        `Error calling ${methodName} on ${contractId}:`,
        error.message
      );
      return null;
    }
  },
  viewState: async (contractId) => {
    try {
      const result = await query(client, {
        finality: "final",
        requestType: "view_state",
        accountId: contractId,
        prefixBase64: "",
      });
      return result.values;
    } catch (error) {
      console.warn(`Error viewing state for ${contractId}:`, error.message);
      return null;
    }
  },

  viewAccount: async (accountId) => {
    if (!accountId) {
      return null;
    }
    try {
      const account = await viewAccountNear(client, {
        accountId: accountId,
        finality: "final",
      });
      return account;
    } catch (error) {
      // Account doesn't exist or network error
      console.warn(`Error viewing account ${accountId}:`, error.message);
      return null;
    }
  },
};
