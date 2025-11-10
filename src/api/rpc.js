import { logger } from "@/helpers/logger";
import {
  getNearStakedPools,
  fetchTokenMetadataByDefuseAssetId,
  fetchBlockchainByNetwork,
} from "@/api/backend";
import { Near } from "@/api/near";
import Big from "big.js";
import { formatNearAmount } from "@/helpers/nearHelpers";

export const getNearBalances = async (accountId) => {
  try {
    const result = await Near.viewAccount(accountId);
    if (!result) {
      return null;
    }
    const storage = Big(result?.storageUsage ?? "0")
      .mul(Big(10).pow(19))
      .toFixed();
    const total = Big(result?.amount ?? "0").toFixed();
    const available = Big(result?.amount ?? "0")
      .minus(storage ?? "0")
      .toFixed();

    return {
      total,
      available,
      storage,
      totalParsed: formatNearAmount(total),
      availableParsed: formatNearAmount(available),
      storageParsed: formatNearAmount(storage),
    };
  } catch (error) {
    logger.error("Error getting NEAR Balances:", error);
    return null;
  }
};

export const getNearStakedBalances = async (accountId) => {
  try {
    const stakingPools = await getNearStakedPools(accountId);

    if (stakingPools.length === 0) {
      return [];
    }
    const result = [];
    await Promise.all(
      stakingPools.map(async (pool) => {
        const stakedBalances = await Near.view(
          pool,
          "get_account_staked_balance",
          { account_id: accountId }
        );
        const unstakedBalances = await Near.view(
          pool,
          "get_account_unstaked_balance",
          { account_id: accountId }
        );
        const isUnstakedBalanceAvailable = await Near.view(
          pool,
          "is_account_unstaked_balance_available",
          { account_id: accountId }
        );

        result.push({
          poolId: pool,
          staked: formatNearAmount(stakedBalances),
          unstaked: isUnstakedBalanceAvailable
            ? 0
            : formatNearAmount(unstakedBalances),
          availableToWithdraw: isUnstakedBalanceAvailable
            ? formatNearAmount(unstakedBalances)
            : 0,
          total: formatNearAmount(
            Big(stakedBalances).plus(Big(unstakedBalances)).toFixed()
          ),
        });
      })
    );
    return result;
  } catch (error) {
    logger.error("Error getting NEAR Staked Balances:", error);
    return null;
  }
};

export const getIntentsBalances = async (accountId) => {
  try {
    if (!accountId) {
      return [];
    }

    // First get tokens owned by this account
    const ownedTokens = await Near.view("intents.near", "mt_tokens_for_owner", {
      account_id: accountId,
    });

    if (!ownedTokens || ownedTokens.length === 0) {
      return [];
    }

    // Get balances for owned tokens first
    const tokenIds = ownedTokens.map((t) => t.token_id);
    const balances = await Near.view("intents.near", "mt_batch_balance_of", {
      account_id: accountId,
      token_ids: tokenIds,
    });

    if (balances === null || typeof balances === "undefined") {
      logger.error("Failed to fetch balances from intents.near", balances);
      return []; // Return empty array on error
    }

    // Filter to only tokens with non-zero balances
    const tokensWithBalances = ownedTokens
      .map((token, i) => ({
        token_id: token.token_id,
        amount: balances[i],
      }))
      .filter((token) => token.amount && Big(token.amount).gt(0));

    if (tokensWithBalances.length === 0) {
      return [];
    }

    // Fetch metadata for all tokens in a single batch request
    const defuseAssetIds = tokensWithBalances.map((t) => t.token_id);
    const metadataResults =
      await fetchTokenMetadataByDefuseAssetId(defuseAssetIds);

    // Create a map for quick lookup
    const metadataMap = {};
    metadataResults.forEach((metadata) => {
      if (metadata.defuseAssetId) {
        metadataMap[metadata.defuseAssetId] = metadata;
      }
    });

    // Extract unique blockchain/network names and fetch network metadata
    const uniqueNetworks = [
      ...new Set(
        metadataResults
          .map((m) => m.blockchain)
          .filter((blockchain) => blockchain)
      ),
    ];

    const networkData =
      uniqueNetworks.length > 0
        ? await fetchBlockchainByNetwork(uniqueNetworks)
        : [];

    // Create a map for blockchain data
    const blockchainMap = {};
    networkData.forEach((network) => {
      if (network.network) {
        blockchainMap[network.network.toLowerCase()] = network;
      }
    });

    // Combine token data with metadata and blockchain info
    const finalTokens = tokensWithBalances
      .map((token) => {
        const metadata = metadataMap[token.token_id];
        if (!metadata) return null;

        const blockchainInfo = metadata.blockchain
          ? blockchainMap[metadata.blockchain.toLowerCase()]
          : null;

        return {
          // contract_id is needed by TokensDropdown (without prefix for backward compatibility)
          contract_id: token.token_id.startsWith("nep141:")
            ? token.token_id.split(":")[1]
            : token.token_id,
          // Preserve full token_id with prefix (nep141:, nep245:, etc.) for proper intents operations
          token_id: token.token_id,
          ft_meta: {
            symbol: metadata.symbol,
            icon: metadata.icon,
            decimals: metadata.decimals,
            price: metadata.price, // Include price if available
          },
          amount: token.amount,
          blockchain: metadata.blockchain,
          blockchainName:
            blockchainInfo?.name || (metadata.blockchain || "").toUpperCase(),
        };
      })
      .filter((token) => token !== null);

    return finalTokens;
  } catch (error) {
    logger.error("Error getting intents balances:", error);
    return [];
  }
};
