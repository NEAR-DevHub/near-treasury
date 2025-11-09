import { tokens } from "@web3icons/common";
import { svgs } from "@web3icons/core";

export async function getWeb3IconMaps() {
  const tokenIconMap = {};
  const networkIconMap = {};
  const networkNames = {};
  const BACKEND_API_BASE = "https://ref-sdk-test-cold-haze-1300-2.fly.dev/api";

  const supportedTokens = await fetch("https://bridge.chaindefuser.com/rpc", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "dontcare",
      method: "supported_tokens",
      params: [{}],
    }),
  }).then((r) => r.json());

  // Filter to nep141 tokens and get their defuse asset IDs
  const filteredTokens = supportedTokens.result.tokens.filter(
    (token) => token.standard === "nep141"
  );

  const defuseAssetIds = filteredTokens
    .map((token) => token.intents_token_id)
    .filter((id) => id);

  if (defuseAssetIds.length === 0) {
    console.error("No defuse asset IDs found");
    return { tokenIconMap, networkIconMap, networkNames };
  }

  // Fetch token metadata from backend API (same as frontend does)
  const tokenIdsString = defuseAssetIds.join(",");
  console.log(
    `Fetching metadata for ${defuseAssetIds.length} tokens from backend API`
  );
  const metadataResults = await fetch(
    `${BACKEND_API_BASE}/token-by-defuse-asset-id?defuseAssetId=${tokenIdsString}`
  ).then((r) => r.json());

  console.log(`Received ${metadataResults?.length || 0} metadata results`);
  if (metadataResults?.length > 0) {
    console.log(
      "Sample metadata result:",
      JSON.stringify(metadataResults[0], null, 2)
    );
  }

  // Create metadata map
  const metadataMap = {};
  metadataResults.forEach((metadata) => {
    if (metadata.defuse_asset_id) {
      metadataMap[metadata.defuse_asset_id] = metadata;
    }
  });

  // Collect unique chain names and chain IDs from tokens
  const uniqueChainNames = new Set();
  const chainIdToChainName = {}; // Map chain IDs to chainName (e.g., "eth:42161" -> "arbitrum")

  for (const token of filteredTokens) {
    const tokenMetadata = metadataMap[token.intents_token_id];

    // Use chainName from metadata
    const chainName = tokenMetadata?.chainName;
    if (!chainName) {
      console.log("skipping", token.intents_token_id, "- no chainName");
      continue;
    }
    uniqueChainNames.add(chainName);

    // Also track the chain ID for this chainName
    if (token.defuse_asset_identifier) {
      const defuse_asset_id_parts = token.defuse_asset_identifier.split(":");
      const layer1 = defuse_asset_id_parts[0];
      const layer2 = defuse_asset_id_parts[1];
      const chainId = `${layer1}:${layer2}`;
      chainIdToChainName[chainId] = chainName;
    }

    const web3IconToken = tokens.find(
      (web3IconToken) =>
        web3IconToken.symbol.toLowerCase() === token.asset_name.toLowerCase()
    );
    if (web3IconToken) {
      const tokenSvg = svgs.tokens.background[web3IconToken.fileName].default;
      if (tokenSvg) {
        tokenIconMap[token.asset_name] = tokenSvg;
      }
    }
  }

  // Fetch network names from backend API (same as the app uses)
  try {
    const networkString = Array.from(uniqueChainNames).join(",");
    console.log(
      "Fetching networks for chainNames:",
      Array.from(uniqueChainNames)
    );
    const response = await fetch(
      `${BACKEND_API_BASE}/blockchain-by-network?network=${networkString}&theme=light`
    );
    const networkResults = await response.json();
    console.log("Received network results:", networkResults.length, "networks");

    // Build networkNames mapping from API response
    networkResults.forEach((network) => {
      if (network.network && network.name) {
        // Map by chainName (e.g., "arbitrum" -> "Arbitrum")
        networkNames[network.network] = network.name;
        networkIconMap[network.network] = network.icon;
      }
    });

    // Also add mappings by chain ID using our tracked mapping
    let mappedCount = 0;
    let missingCount = 0;
    for (const [chainId, chainName] of Object.entries(chainIdToChainName)) {
      if (networkNames[chainName]) {
        networkNames[chainId] = networkNames[chainName];
        mappedCount++;
      } else {
        console.warn(
          `Missing network name for chainName "${chainName}" (chain ID: ${chainId})`
        );
        missingCount++;
      }
    }
    console.log(`Mapped ${mappedCount} chain IDs, ${missingCount} missing`);
  } catch (error) {
    console.error("Error fetching network names from backend:", error);
  }

  console.log("chainIdToChainName mapping:", chainIdToChainName);
  console.log("networkNames mapping:", networkNames);
  return { tokenIconMap, networkIconMap, networkNames };
}
