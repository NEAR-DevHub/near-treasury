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
} from "@near-js/jsonrpc-client";
import { readFile } from "fs/promises";

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

    return result;
  }

  async viewFunction(contractId, methodName, args = {}) {
    const result = await query(this.rpcClient, {
      request_type: "call_function",
      finality: "final",
      account_id: contractId,
      method_name: methodName,
      args_base64: Buffer.from(JSON.stringify(args)).toString("base64"),
    });

    return JSON.parse(Buffer.from(result.result).toString());
  }

  async viewFunctionMainnet(contractId, methodName, args = {}) {
    const mainnetRpcClient = new NearRpcClient("https://rpc.mainnet.near.org");
    const result = await query(mainnetRpcClient, {
      request_type: "call_function",
      finality: "final",
      account_id: contractId,
      method_name: methodName,
      args_base64: Buffer.from(JSON.stringify(args)).toString("base64"),
    });

    return JSON.parse(Buffer.from(result.result).toString());
  }

  async importMainnetContract(accountId, mainnetContractId) {
    // First create the account
    await this.createAccount(accountId);

    // Fetch contract code from mainnet
    const mainnetRpcClient = new NearRpcClient("https://rpc.mainnet.near.org");
    const contractCode = await query(mainnetRpcClient, {
      request_type: "view_code",
      finality: "final",
      account_id: mainnetContractId,
    });

    // Deploy the contract code to sandbox
    const wasmCode = Buffer.from(contractCode.code_base64, "base64");
    await this.deployContract(accountId, wasmCode);

    console.log(`✓ Imported and deployed ${mainnetContractId} to ${accountId}`);
    return accountId;
  }

  getRpcUrl() {
    return this.sandbox.rpcUrl;
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
