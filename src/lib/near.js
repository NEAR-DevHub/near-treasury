import { NearRpcClient, viewAccount as viewAccountNear,viewFunctionAsJson,query   } from '@near-js/jsonrpc-client';

export const client = new NearRpcClient({
  endpoint: 'https://rpc.mainnet.fastnear.com',
});

export const Near = {
  view: async (contractId, methodName, args = {}) => {
    if(!contractId || !methodName) {
      return null;
    }
   const result = await viewFunctionAsJson(client, {
    accountId: contractId,
    methodName: methodName,
    finality: "final",
    argsBase64: Buffer.from(JSON.stringify(args)).toString('base64'),
  });
    return result;
  },
  viewState: async (contractId) => {
    const result = await query(client, {
        finality: "final",
        requestType: "view_state",
        accountId: contractId,
       prefixBase64:''
      
    })
    return result.values
  },

  viewAccount: async (accountId) => {
    if(!accountId) {
      return null;
    }
    const account = await viewAccountNear(client, {
      accountId: accountId,
      finality: 'final',
    });
    return account;
  }
};
