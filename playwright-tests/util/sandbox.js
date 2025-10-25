import { Sandbox, DEFAULT_PRIVATE_KEY, DEFAULT_PUBLIC_KEY } from "near-sandbox";
import { KeyPair, transactions, utils } from "near-api-js";
import crypto from "crypto";
import {
  NearRpcClient,
  broadcastTxCommit,
  status,
  block,
  viewAccessKey,
  query,
  viewFunctionAsJson,
} from "@near-js/jsonrpc-client";

export class NearSandbox {
  constructor() {
    this.sandbox = null;
    this.rpcClient = null;
    this.accountKeys = new Map();
    this.defaultKeyPair = null;
  }

  async start(config = {}) {
    const defaultConfig = {
      version: "2.8.0",
      config: {
        additionalGenesis: {
          records: [
            {
              Account: {
                account_id: "test.near",
                account: {
                  amount: "1000000000000000000000000000000000",
                  locked: "50000000000000000000000000000000",
                  code_hash: "11111111111111111111111111111111",
                  storage_usage: 0,
                  version: "V1",
                },
              },
            },
            {
              AccessKey: {
                account_id: "test.near",
                public_key: DEFAULT_PUBLIC_KEY,
                access_key: { nonce: 0, permission: "FullAccess" },
              },
            },
            {
              Account: {
                account_id: "near",
                account: {
                  amount: "1000000000000000000000000000000000",
                  locked: "0",
                  code_hash: "11111111111111111111111111111111",
                  storage_usage: 0,
                  version: "V1",
                },
              },
            },
            {
              AccessKey: {
                account_id: "near",
                public_key: DEFAULT_PUBLIC_KEY,
                access_key: { nonce: 0, permission: "FullAccess" },
              },
            },
            {
              Account: {
                account_id: "sandbox",
                account: {
                  amount: "10000000000000000000000000000",
                  locked: "0",
                  code_hash: "11111111111111111111111111111111",
                  storage_usage: 182,
                },
              },
            },
            {
              AccessKey: {
                account_id: "sandbox",
                public_key: DEFAULT_PUBLIC_KEY,
                access_key: { nonce: 0, permission: "FullAccess" },
              },
            },
          ],
        },
      },
    };

    this.sandbox = await Sandbox.start({ ...defaultConfig, ...config });

    // Wait for sandbox to be ready
    await new Promise((resolve) => setTimeout(resolve, 3000));
    console.log("✓ Sandbox ready");

    this.rpcClient = new NearRpcClient(this.sandbox.rpcUrl);

    // Verify RPC connection
    const result = await status(this.rpcClient);
    console.log(`✓ RPC connection verified - Chain ID: ${result.chainId}`);

    // Setup default keypair
    this.defaultKeyPair = KeyPair.fromString(DEFAULT_PRIVATE_KEY);
    this.accountKeys.set("test.near", this.defaultKeyPair);
    this.accountKeys.set("near", this.defaultKeyPair);
    this.accountKeys.set("sandbox", this.defaultKeyPair);

    return this;
  }

  async stop() {
    if (this.sandbox) {
      await this.sandbox.tearDown();
    }
  }

  async getLatestBlockHash() {
    const result = await block(this.rpcClient, { finality: "final" });
    return result.header.hash;
  }

  async getAccessKeyNonce(accountId, publicKey) {
    const result = await viewAccessKey(this.rpcClient, {
      accountId,
      publicKey,
      finality: "final",
    });
    return result.nonce;
  }

  async createAccount(accountId, initialBalance = "100000000000000000000000000") {
    const newKeyPair = KeyPair.fromRandom("ed25519");
    this.accountKeys.set(accountId, newKeyPair);

    const actions = [
      transactions.createAccount(),
      transactions.transfer(
        utils.format.parseNearAmount(initialBalance.replace(/0{24}$/, ""))
      ),
      transactions.addKey(newKeyPair.getPublicKey(), transactions.fullAccessKey()),
    ];

    const blockHash = await this.getLatestBlockHash();
    const parentAccount = accountId.endsWith("test.near") ? "test.near" : "near";
    const nonce = await this.getAccessKeyNonce(
      parentAccount,
      this.defaultKeyPair.getPublicKey().toString()
    );

    const tx = transactions.createTransaction(
      parentAccount,
      this.defaultKeyPair.getPublicKey(),
      accountId,
      nonce + 1,
      actions,
      utils.serialize.base_decode(blockHash)
    );

    // Serialize and sign the transaction
    const serializedTx = utils.serialize.serialize(transactions.SCHEMA.Transaction, tx);
    const txHash = crypto.createHash("sha256").update(serializedTx).digest();
    const signature = this.defaultKeyPair.sign(txHash);

    const signedTx = new transactions.SignedTransaction({
      transaction: tx,
      signature: new transactions.Signature({
        keyType: tx.publicKey.keyType,
        data: signature.signature,
      }),
    });

    const signedTxBytes = signedTx.encode();
    const signedTxBase64 = Buffer.from(signedTxBytes).toString("base64");
    const result = await broadcastTxCommit(this.rpcClient, {
      signedTxBase64: signedTxBase64,
      waitUntil: "FINAL",
    });

    if (result.status.SuccessValue !== undefined) {
      console.log(`✓ Created account: ${accountId}`);
    } else if (result.status.Failure) {
      console.error(`✗ Failed to create account ${accountId}:`, result.status.Failure);
      throw new Error(`Failed to create account ${accountId}`);
    }

    // Wait for block finalization before next transaction
    await this.waitForBlock();

    return accountId;
  }

  async deployContract(accountId, wasmCode) {
    const keyPair = this.accountKeys.get(accountId);
    if (!keyPair) {
      throw new Error(`Account ${accountId} not found. Create it first.`);
    }

    const actions = [transactions.deployContract(wasmCode)];
    const blockHash = await this.getLatestBlockHash();
    const nonce = await this.getAccessKeyNonce(
      accountId,
      keyPair.getPublicKey().toString()
    );

    const tx = transactions.createTransaction(
      accountId,
      keyPair.getPublicKey(),
      accountId,
      nonce + 1,
      actions,
      utils.serialize.base_decode(blockHash)
    );

    const serializedTx = utils.serialize.serialize(transactions.SCHEMA.Transaction, tx);
    const txHash = crypto.createHash("sha256").update(serializedTx).digest();
    const signature = keyPair.sign(txHash);

    const signedTx = new transactions.SignedTransaction({
      transaction: tx,
      signature: new transactions.Signature({
        keyType: tx.publicKey.keyType,
        data: signature.signature,
      }),
    });

    const signedTxBytes = signedTx.encode();
    const signedTxBase64 = Buffer.from(signedTxBytes).toString("base64");
    const result = await broadcastTxCommit(this.rpcClient, {
      signedTxBase64: signedTxBase64,
      waitUntil: "FINAL",
    });

    if (result.status.SuccessValue !== undefined) {
      console.log(`✓ Deployed contract to: ${accountId}`);
    } else if (result.status.Failure) {
      console.error(`✗ Failed to deploy contract to ${accountId}:`, result.status.Failure);
      throw new Error(`Failed to deploy contract to ${accountId}`);
    }

    // Wait for block finalization before next transaction
    await this.waitForBlock();

    return result;
  }

  async functionCall(signerId, receiverId, methodName, args = {}, gas = "30000000000000", deposit = "0") {
    const keyPair = this.accountKeys.get(signerId);
    if (!keyPair) {
      throw new Error(`Account ${signerId} not found`);
    }

    const actions = [
      transactions.functionCall(
        methodName,
        Buffer.from(JSON.stringify(args)),
        BigInt(gas),
        BigInt(deposit)
      ),
    ];

    const blockHash = await this.getLatestBlockHash();
    const nonce = await this.getAccessKeyNonce(
      signerId,
      keyPair.getPublicKey().toString()
    );

    const tx = transactions.createTransaction(
      signerId,
      keyPair.getPublicKey(),
      receiverId,
      nonce + 1,
      actions,
      utils.serialize.base_decode(blockHash)
    );

    const serializedTx = utils.serialize.serialize(transactions.SCHEMA.Transaction, tx);
    const txHash = crypto.createHash("sha256").update(serializedTx).digest();
    const signature = keyPair.sign(txHash);

    const signedTx = new transactions.SignedTransaction({
      transaction: tx,
      signature: new transactions.Signature({
        keyType: tx.publicKey.keyType,
        data: signature.signature,
      }),
    });

    const signedTxBytes = signedTx.encode();
    const signedTxBase64 = Buffer.from(signedTxBytes).toString("base64");
    const result = await broadcastTxCommit(this.rpcClient, {
      signedTxBase64: signedTxBase64,
      waitUntil: "FINAL",
    });

    // Wait for block finalization before next transaction
    await this.waitForBlock();

    // Enhance result with helper methods and properties
    return this._enhanceResult(result);
  }

  async waitForBlock(delayMs = 1000) {
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }

  _enhanceResult(result) {
    // Collect all logs from receipts (try both snake_case and camelCase)
    const allLogs = [];
    const receiptsOutcome = result.receipts_outcome || result.receiptsOutcome;

    if (receiptsOutcome) {
      for (const receipt of receiptsOutcome) {
        const outcome = receipt.outcome;
        if (outcome && outcome.logs) {
          allLogs.push(...outcome.logs);
        }
      }
    }

    // Add helper methods
    result.logs = allLogs;
    result.logsContain = (pattern) => {
      return allLogs.some(log => log.includes(pattern));
    };
    result.failed = result.status?.Failure !== undefined;

    return result;
  }

  async viewFunction(contractId, methodName, args = {}) {
    return await viewFunctionAsJson(this.rpcClient, {
      accountId: contractId,
      methodName: methodName,
      argsBase64: Buffer.from(JSON.stringify(args)).toString("base64"),
      finality: "final",
    });
  }

  async viewFunctionMainnet(contractId, methodName, args = {}) {
    const mainnetRpcClient = new NearRpcClient("https://rpc.mainnet.fastnear.com");
    return await viewFunctionAsJson(mainnetRpcClient, {
      accountId: contractId,
      methodName: methodName,
      argsBase64: Buffer.from(JSON.stringify(args)).toString("base64"),
      finality: "final",
    });
  }

  async importMainnetContract(accountId, mainnetContractId) {
    // First create the account
    await this.createAccount(accountId);

    // Fetch contract code from mainnet
    const mainnetRpcClient = new NearRpcClient("https://rpc.mainnet.fastnear.com");
    const contractCode = await query(mainnetRpcClient, {
      requestType: "view_code",
      finality: "final",
      accountId: mainnetContractId,
    });

    // Deploy the contract code to sandbox
    const wasmCode = contractCode.codeBase64 ? Buffer.from(contractCode.codeBase64, "base64") : null;
    if (!wasmCode) {
      throw new Error(`No contract code found for ${mainnetContractId}`);
    }
    await this.deployContract(accountId, wasmCode);

    console.log(`✓ Imported and deployed ${mainnetContractId} to ${accountId}`);
    return accountId;
  }

  getRpcUrl() {
    return this.sandbox.rpcUrl;
  }

  getKeyPair(accountId) {
    return this.accountKeys.get(accountId);
  }
}

export async function parseNEAR(amount) {
  const yoctoPerNear = BigInt("1000000000000000000000000");
  const parts = amount.toString().split(".");
  const whole = BigInt(parts[0] || 0) * yoctoPerNear;
  const fractional = parts[1]
    ? BigInt(parts[1].padEnd(24, "0").slice(0, 24))
    : BigInt(0);
  return (whole + fractional).toString();
}

export async function setPageAuthSettings(page, accountId, keyPair) {
  // Patch wallet selector to bypass signature checks
  await page.route(
    "https://ga.jspm.io/npm:@near-wallet-selector/my-near-wallet@9.4.0/index.js",
    async (route) => {
      const response = await route.fetch();
      const body = await response.text();
      const patchedBody = body.replace(
        "storedKeyCanSign(r,e){",
        "storedKeyCanSign(r,e){\nreturn true;"
      );
      await route.fulfill({ response, body: patchedBody });
    }
  );

  // Set authentication in localStorage
  await page.evaluate(
    ({ accountId, publicKey, privateKey }) => {
      localStorage.setItem(
        "selected-wallet",
        "mynearwallet"
      );
      localStorage.setItem(
        "mynearwallet:signedAccountId",
        accountId
      );
    },
    {
      accountId,
      publicKey: keyPair.getPublicKey().toString(),
      privateKey: keyPair.toString(),
    }
  );

  // Reload to apply changes
  await page.reload();
}

/**
 * Inject a test wallet for @hot-labs/near-connect
 * This wallet will sign transactions using the sandbox keypair
 */
export async function injectTestWallet(page, sandbox, accountId) {
  const keyPair = sandbox.getKeyPair(accountId);
  const rpcUrl = sandbox.getRpcUrl();

  // Verify imports
  console.log('Injected wallet setup - transactions:', typeof transactions, 'utils:', typeof utils);

  // Expose signing function to the page - this function executes in Node.js context
  await page.exposeFunction('__testWalletSign', async (transaction) => {
    console.log('__testWalletSign called, transactions available:', typeof transactions);
    const client = new NearRpcClient({ endpoint: rpcUrl });

    // Transform actions from wallet format to near-api-js format
    const nearActions = transaction.actions.map(action => {
      if (action.type === 'FunctionCall') {
        // args is already a Uint8Array or buffer from the wallet
        const args = action.params.args;
        return transactions.functionCall(
          action.params.methodName,
          args,
          BigInt(action.params.gas || '30000000000000'),
          BigInt(action.params.deposit || '0')
        );
      }
      // Add other action types as needed
      throw new Error(`Unsupported action type: ${action.type}`);
    });

    // Get access key nonce
    const accessKeyResult = await viewAccessKey(client, {
      accountId,
      publicKey: keyPair.getPublicKey().toString(),
      finality: 'final',
    });

    const nonce = BigInt(accessKeyResult.nonce) + 1n;

    // Get latest block hash
    const blockResult = await block(client, { finality: 'final' });
    const blockHash = utils.serialize.base_decode(blockResult.header.hash);

    // Create transaction
    const tx = transactions.createTransaction(
      accountId,
      keyPair.getPublicKey(),
      transaction.receiverId,
      nonce,
      nearActions,
      blockHash
    );

    // Sign transaction
    const serializedTx = utils.serialize.serialize(
      transactions.SCHEMA.Transaction,
      tx
    );

    // Hash the serialized transaction
    const hashBuffer = await crypto.subtle.digest('SHA-256', serializedTx);
    const signature = keyPair.sign(new Uint8Array(hashBuffer));

    const signedTx = new transactions.SignedTransaction({
      transaction: tx,
      signature: new transactions.Signature({
        keyType: tx.publicKey.keyType,
        data: signature.signature,
      }),
    });

    // Broadcast transaction
    const signedTxBase64 = Buffer.from(signedTx.encode()).toString('base64');
    const result = await broadcastTxCommit(client, {
      signedTxBase64,
      waitUntil: 'EXECUTED',
    });

    return result;
  });

  // Inject the test wallet immediately before any scripts run
  await page.addInitScript(({ accountId }) => {
    // Create test wallet object
    const testWallet = {
      manifest: {
        id: 'test-wallet',
        name: 'Test Wallet',
        description: 'Automated test wallet for sandbox',
        icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>',
        type: 'injected',
        features: {
          signMessage: true,
          signTransaction: true,
          signAndSendTransaction: true,
          signAndSendTransactions: true,
        }
      },

      async isSignedIn() {
        return true;
      },

      async getAddress() {
        return accountId;
      },

      async getAccounts() {
        return [{ accountId }];
      },

      async signIn() {
        return { accounts: [{ accountId }] };
      },

      async signOut() {
        // No-op for tests
      },

      async signAndSendTransaction({ receiverId, actions }) {
        try {
          const result = await window.__testWalletSign({
            receiverId,
            actions,
          });
          return result;
        } catch (error) {
          console.error('Test wallet sign error:', error);
          throw error;
        }
      },

      async signAndSendTransactions({ transactions }) {
        const results = [];
        for (const tx of transactions) {
          const result = await this.signAndSendTransaction(tx);
          results.push(result);
        }
        return results;
      },
    };

    // Store in window for access
    window.__testWallet = testWallet;

    // Set localStorage
    localStorage.setItem('selected-wallet', 'test-wallet');

    // Inject wallet immediately when near-selector-ready fires
    document.addEventListener('DOMContentLoaded', () => {
      window.dispatchEvent(
        new CustomEvent('near-wallet-injected', { detail: testWallet })
      );
      console.log('✓ Test wallet injected for:', accountId);
    });

    // Also listen for the selector ready event
    window.addEventListener('near-selector-ready', () => {
      window.dispatchEvent(
        new CustomEvent('near-wallet-injected', { detail: testWallet })
      );
      console.log('✓ Test wallet injected (selector-ready) for:', accountId);
    });
  }, { accountId });
}
