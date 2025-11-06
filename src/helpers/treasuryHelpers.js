/**
 * Treasury-specific helper functions
 */

import { getUserDaos } from "@/api/backend";
import { Near } from "@/api/near";
import { fetchSupportedTokens } from "@/api/chaindefuser";
import { fetchTokenMetadataByDefuseAssetId, fetchBlockchainByNetwork } from "@/api/backend";
import Big from "big.js";

/**
 * Get list of treasuries for a user account
 * Checks for frontend existence and includes config data
 */
export async function getUserTreasuries(accountId) {
  if (!accountId) return [];

  try {
    const userDaos = await getUserDaos(accountId);

    const treasuries = await Promise.all(
      userDaos.map(async (daoId) => {
        try {
          const config= await  Near.view(daoId, "get_config", {});
          const metadata = config.metadata
            ? JSON.parse(atob(config.metadata))
            : null;

          return {
            daoId,
            config: {
              ...config,
              metadata,
            },
          };
        } catch (error) {
          console.error(`Error processing DAO ${daoId}:`, error);
          return null;
        }
      })
    );

    return treasuries.filter(Boolean);
  } catch (error) {
    console.error("Error getting user treasuries:", error);
    return [];
  }
}

/**
 * Fetch all bridgeable tokens, enrich with metadata and network info, and aggregate by asset name.
 * Optionally merges Intents balances to show per-network and per-asset totals.
 *
 * Returns an array like:
 * [
 *   {
 *     asset_name, name, symbol, icon, price,
 *     totalAmount, totalUsd,
 *     networks: [ { id, label, icon, chainId, decimals, amount? } ]
 *   }
 * ]
 */
export async function getAggregatedIntentsAssets({ intentsBalances = [], theme = "light" } = {}) {
  try {
    const supported = await fetchSupportedTokens();
    const allTokens = (supported?.tokens || []).filter((t) => t.standard === "nep141");
    
    // Deduplicate by intents_token_id to avoid double-counting balances
    // Some tokens (like NEAR/wNEAR) may have duplicate entries with the same intents_token_id
    const tokenMap = {};
    allTokens.forEach((t) => {
      if (t.intents_token_id && !tokenMap[t.intents_token_id]) {
        tokenMap[t.intents_token_id] = t;
      }
    });
    const tokens = Object.values(tokenMap);

    const defuseIds = tokens.map((t) => t.intents_token_id).filter(Boolean);
    const metadataList = defuseIds.length
      ? await fetchTokenMetadataByDefuseAssetId(defuseIds)
      : [];

    const metadataMap = {};
    (metadataList || []).forEach((m) => {
      const key = m.defuseAssetId || m.defuse_asset_id || m.defuseAssetID;
      if (key) metadataMap[key] = m;
    });

    const enrichedTokens = tokens
      .map((token) => {
        const metadata = metadataMap[token.intents_token_id];
        if (!metadata) {
          return null;
        }
        return {
          ...token,
          ...metadata,
        };
      })
      .filter((token) => token !== null && token.chainName);

    const uniqueChainNames = new Set();
    enrichedTokens.forEach((token) => {
      uniqueChainNames.add(token.chainName);
    });

    // Fetch network icons
    const networkResults = await fetchBlockchainByNetwork(
      Array.from(uniqueChainNames),
      theme
    );

    const networkIconMap = {};
    (networkResults || []).forEach((network) => {
      if (network.network && network.icon) {
        networkIconMap[network.network] = {
          name: network.name || network.network,
          icon: network.icon,
        };
      }
    });

    // Build balances map (raw amounts are in smallest units)
    const balanceRawById = {};
    (intentsBalances || []).forEach((b) => {
      balanceRawById[b.token_id] = b.amount;
    });

    // Group by CANONICAL SYMBOL to avoid duplicates like wNEAR/NEAR entries for the same token
    // Canonical key prefers metadata.symbol (uppercased); falls back to asset_name uppercased
    const assetMap = {};
    
    tokens.forEach((t) => {
      const meta = metadataMap[t.intents_token_id];
      if (!meta) return;
      
      const canonicalSymbol = (meta.symbol || t.asset_name || "").toUpperCase();
      
      if (!assetMap[canonicalSymbol]) {
        assetMap[canonicalSymbol] = {
          asset_name: meta.symbol || t.asset_name || "",
          name: meta.name || t.name,
          symbol: meta.symbol || t.asset_name || "",
          icon: meta.icon || null,
          price: meta.price || 0,
          totalAmount: "0",
          networks: [],
        };
      }

      // Derive chain id like "eth:1" from defuse_asset_identifier
      const parts = (t.defuse_asset_identifier || "").split(":");
      const chainId = parts.length >= 2 ? parts.slice(0, 2).join(":") : parts[0];
      // Get chainName from enriched token (same as Intents component approach)
      const enrichedToken = enrichedTokens.find((et) => et.intents_token_id === t.intents_token_id);
      const chainName = enrichedToken?.chainName;
      const netInfo = networkIconMap[chainName] || { name: chainName || chainId, icon: null };

      // Compute readable balance if available
      let amountReadable = undefined;
      const raw = balanceRawById[t.intents_token_id];
      if (raw) {
        const decimals = meta.decimals || 18;
        amountReadable = Big(raw).div(Big(10).pow(decimals)).toString();
        
        // add to asset total
        assetMap[canonicalSymbol].totalAmount = Big(assetMap[canonicalSymbol].totalAmount || "0")
          .plus(amountReadable)
          .toString();
      }

      // Check if network with this id already exists to avoid duplicates
      const networkId = t.intents_token_id;
      const existingNetworkIndex = assetMap[canonicalSymbol].networks.findIndex(
        (n) => n.id === networkId
      );

      if (existingNetworkIndex >= 0) {
        // Network already exists - merge amounts if both have balances
        const existingNetwork = assetMap[canonicalSymbol].networks[existingNetworkIndex];
        if (amountReadable && existingNetwork.amount) {
          // Sum the amounts
          existingNetwork.amount = Big(existingNetwork.amount || "0")
            .plus(amountReadable)
            .toString();
        } else if (amountReadable && !existingNetwork.amount) {
          // Update with new amount
          existingNetwork.amount = amountReadable;
        }
      } else {
        // New network - add it
        assetMap[canonicalSymbol].networks.push({
          id: networkId,
          label: netInfo.name,
          icon: netInfo.icon,
          chainId,
          decimals: meta.decimals || 18,
          amount: amountReadable, // may be undefined when no balance
        });
      }
    });

    const assets = Object.values(assetMap).map((a) => ({
      ...a,
      totalUsd: Big(a.totalAmount || 0).mul(a.price || 0).toString(),
    }));

    return assets;
  } catch (e) {
    console.error("getAggregatedIntentsAssets error", e);
    return [];
  }
}

