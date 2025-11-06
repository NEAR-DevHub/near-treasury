"use client";

import { useState, useEffect } from "react";
import { useDao } from "@/context/DaoContext";
import { useTheme } from "@/context/ThemeContext";
import { fetchDepositAddress } from "@/api/chaindefuser";
import { getAggregatedIntentsAssets } from "@/helpers/treasuryHelpers";
import DropdownWithModal from "@/components/dropdowns/DropdownWithModal";
import DepositAddress from "@/app/[daoId]/dashboard/intents-deposit/DepositAddress";
import FAQSection from "@/components/ui/FAQSection";
import Skeleton from "@/components/ui/Skeleton";

const placeholderAssetIcon =
  "https://ipfs.near.social/ipfs/bafkreib7ahtyc3p6txuwcnn6kmfo5naiyjzomqnpt26crv27prd5f3ogt4";
const placeholderNetworkIcon =
  "https://ipfs.near.social/ipfs/bafkreihc5rbvgxf4sz36pqdbg2gv2ag5erjm472zo2hapeh24idcvumt7m";

const faqItems = [
  {
    question: "What is NEAR Intents and why is it useful?",
    answer:
      "NEAR Intents is a feature in the Treasury Dashboard that allows DAOs to manage assets and payment operations across multiple blockchains from a single interface. It enables organizations to accept deposits from different networks and request payouts in various cryptocurrencies while keeping everything in one place.",
  },
  {
    question: "How can I use my tokens on NEAR Intents?",
    answer:
      "You can manage all your tokens in one place and easily create payment requests. You can also store and control all your assets in a single dashboard and send payout requests.",
  },
  {
    question: "From which blockchains can I deposit using NEAR Intents?",
    answer: `You can make deposits from:
- Ethereum (ETH, USDC, USDT, WETH, AAVE, UNI)
- Bitcoin (BTC)
- Solana (SOL, USDC)
- Base (USDC, BRETT, DEGEN)
- Arbitrum (USDC, GMX, ARB)
- NEAR (wNEAR, REF, AURORA)
- XRP (XRP)
- TRON (TRX, USDT)`,
  },
  {
    question: "Which cryptocurrencies are supported in NEAR Intents?",
    answer: `Supported assets include:
- Native tokens: ETH, BTC, SOL, XRP, TRX
- Stablecoins: USDC, USDT, DAI
- DeFi tokens: AAVE, UNI, COMP
- NEAR ecosystem tokens: wNEAR, REF, AURORA
- Meme tokens: SHITZU, PEPE, DOGE`,
  },
  {
    question:
      "What should I do if the NEAR Intents wallet is not visible in my Treasury?",
    answer:
      "If you don't see the NEAR Intents wallet, it means there are no tokens on it. To create it and make it visible on the Dashboard, you need to fund it using the form provided above.",
  },
];

const StepIndicator = ({ step, isActive, isCompleted }) => (
  <div
    className={`rounded-circle d-flex align-items-center justify-content-center ${
      isCompleted
        ? "bg-theme-color"
        : isActive
        ? "bg-theme-color"
        : "bg-grey-04"
    }`}
    style={{
      width: "25px",
      height: "25px",
      fontSize: "14px",
      flexShrink: 0,
    }}
  >
    {isCompleted ? "✓" : step}
  </div>
);

const Intents = () => {
  const { daoId } = useDao();
  const { isDarkTheme } = useTheme();

  const [currentStep, setCurrentStep] = useState(1);
  const [allFetchedTokens, setAllFetchedTokens] = useState([]);
  const [uniqueAssets, setUniqueAssets] = useState([]);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [
    networksForSelectedAssetDropdown,
    setNetworksForSelectedAssetDropdown,
  ] = useState([]);
  const [selectedNetworkFullInfo, setSelectedNetworkFullInfo] = useState(null);
  const [intentsDepositAddress, setIntentsDepositAddress] = useState("");
  const [isLoadingTokens, setIsLoadingTokens] = useState(false);
  const [isLoadingAddress, setIsLoadingAddress] = useState(false);
  const [errorApi, setErrorApi] = useState(null);
  const [networkIconMap, setNetworkIconMap] = useState({});

  // Fetch tokens for intents
  const fetchIntentsTokens = async () => {
    if (allFetchedTokens.length > 0 || isLoadingTokens) {
      return;
    }

    setIsLoadingTokens(true);
    setErrorApi(null);
    setAllFetchedTokens([]);
    setUniqueAssets([]);
    setSelectedAsset(null);
    setNetworksForSelectedAssetDropdown([]);
    setSelectedNetworkFullInfo(null);
    setIntentsDepositAddress("");

    try {
      const aggregatedAssets = await getAggregatedIntentsAssets({
        intentsBalances: [],
        theme: isDarkTheme ? "dark" : "light",
      });

      if (!aggregatedAssets || aggregatedAssets.length === 0) {
        setErrorApi("No bridgeable assets found.");
        setIsLoadingTokens(false);
        return;
      }

      // Build network icon map from aggregated assets
      const networkIconMapFromAssets = {};
      aggregatedAssets.forEach((asset) => {
        asset.networks?.forEach((network) => {
          if (network.id && network.icon) {
            networkIconMapFromAssets[network.id] = {
              name: network.label || network.chainId,
              icon: network.icon,
            };
          }
        });
      });

      // Transform aggregated assets to match the expected structure
      // Each asset has networks, we need to create tokens from networks
      const enrichedTokens = [];
      aggregatedAssets.forEach((asset) => {
        asset.networks?.forEach((network) => {
          enrichedTokens.push({
            asset_name: asset.asset_name,
            name: asset.name,
            symbol: asset.symbol,
            icon: asset.icon,
            intents_token_id: network.id,
            defuse_asset_identifier: network.id,
            chainName: network.chainId?.split(":")[0] || network.chainId,
            near_token_id: network.id?.replace("nep141:", "") || network.id,
            chainId: network.chainId,
          });
        });
      });

      // Create unique assets (grouped by asset_name)
      const assetMap = {};
      aggregatedAssets.forEach((asset) => {
        const assetName = asset.asset_name;
        if (!assetMap[assetName]) {
          assetMap[assetName] = {
            asset_name: assetName,
            name: asset.name,
            symbol: asset.symbol,
            icon: asset.icon,
            tokens: enrichedTokens.filter(
              (token) => token.asset_name === assetName
            ),
          };
        }
      });

      const uniqueAssets = Object.values(assetMap);

      setAllFetchedTokens(enrichedTokens);
      setUniqueAssets(uniqueAssets);
      setNetworkIconMap(networkIconMapFromAssets);
    } catch (err) {
      console.error("Failed to fetch tokens:", err);
      setErrorApi(err.message || "Failed to fetch assets. Please try again.");
    } finally {
      setIsLoadingTokens(false);
    }
  };

  // Update networks when asset changes
  const updateNetworksForAsset = (selectedAsset) => {
    if (
      !selectedAsset ||
      !selectedAsset.tokens ||
      selectedAsset.tokens.length === 0
    ) {
      setNetworksForSelectedAssetDropdown([]);
      setSelectedNetworkFullInfo(null);
      setIntentsDepositAddress("");
      return;
    }

    const networks = selectedAsset.tokens
      .map((token) => {
        if (!token.intents_token_id && !token.defuse_asset_identifier)
          return null;

        // Get network info from networkIconMap using the token id
        const networkInfo =
          networkIconMap?.[
            token.intents_token_id || token.defuse_asset_identifier
          ];

        // Extract chainId from defuse_asset_identifier or use chainId if available
        let chainId;
        if (token.chainId) {
          chainId = token.chainId;
        } else {
          const parts = (
            token.defuse_asset_identifier ||
            token.intents_token_id ||
            ""
          ).split(":");
          if (parts.length >= 2) {
            chainId = parts.slice(0, 2).join(":");
          } else {
            chainId = parts[0];
          }
        }

        return {
          id: chainId,
          name: networkInfo?.name || token.chainName || chainId,
          icon: networkInfo?.icon || placeholderNetworkIcon,
          near_token_id:
            token.near_token_id ||
            token.intents_token_id?.replace("nep141:", "") ||
            token.intents_token_id,
          originalTokenData: token,
        };
      })
      .filter((network) => network && network.id && network.near_token_id);

    setNetworksForSelectedAssetDropdown(networks);
    setSelectedNetworkFullInfo(null);
    setIntentsDepositAddress("");
  };

  // Fetch deposit address when network changes
  const fetchIntentsDepositAddress = async (networkInfo) => {
    if (!networkInfo || !networkInfo.near_token_id) {
      setIntentsDepositAddress("");
      setIsLoadingAddress(false);
      setErrorApi("Invalid network selection.");
      return;
    }

    setIntentsDepositAddress("");
    setIsLoadingAddress(true);
    setErrorApi(null);

    try {
      const result = await fetchDepositAddress(daoId, networkInfo.id);

      if (result && result.address) {
        setIntentsDepositAddress(result.address);
      } else {
        setIntentsDepositAddress("");
        setErrorApi(
          "Could not retrieve deposit address for the selected asset and network."
        );
      }
    } catch (err) {
      console.error("Failed to fetch deposit address:", err);
      setErrorApi(
        err.message || "Failed to fetch deposit address. Please try again."
      );
      setIntentsDepositAddress("");
    } finally {
      setIsLoadingAddress(false);
    }
  };

  useEffect(() => {
    if (allFetchedTokens.length === 0 && !isLoadingTokens) {
      fetchIntentsTokens();
    }
  }, []);

  const handleAssetSelect = (asset) => {
    setSelectedAsset(asset);
    updateNetworksForAsset(asset);
    if (asset) {
      setCurrentStep(2);
    }
  };

  const handleNetworkSelect = (network) => {
    const networkInfo = network || null;
    fetchIntentsDepositAddress(networkInfo);
    setSelectedNetworkFullInfo(networkInfo);
    setCurrentStep(networkInfo ? 3 : currentStep);
  };

  return (
    <div
      className="d-flex gap-4 align-items-start flex-wrap flex-md-nowrap"
      style={{ fontSize: "14px" }}
    >
      <div className="card card-body" style={{ maxWidth: "700px" }}>
        <div className="d-flex flex-column gap-2">
          <div className="h4 mb-0">NEAR Intents</div>
          <div style={{ fontWeight: 500 }}>
            Best for tokens from other blockchains (BTC, ETH, USDC, etc.) or
            sending cross-chain. Supports payments only. Token exchange coming
            soon.
          </div>

          {/* Step Indicators and Content */}
          <div className="position-relative mt-2">
            <div
              className="position-absolute"
              style={{
                left: "12px",
                top: "10px",
                bottom: "10px",
                width: "2px",
                backgroundColor: "var(--border-color)",
                zIndex: 1,
                maxHeight: "220px",
              }}
            ></div>

            {/* Step 1: Select Asset */}
            <div
              className="d-flex align-items-start gap-3 w-100 mt-2"
              style={{ marginBottom: "2rem" }}
            >
              <div style={{ position: "relative", zIndex: 2 }}>
                <StepIndicator
                  step={1}
                  isActive={currentStep === 1}
                  isCompleted={currentStep > 1}
                />
              </div>
              <div className="flex-1">
                {currentStep >= 1 ? (
                  <div className="d-flex flex-column gap-2">
                    <div className="h5 fw-bold mb-0">Select Asset</div>
                    <DropdownWithModal
                      modalTitle="Select Asset"
                      selectedElement={
                        selectedAsset && (
                          <div className="d-flex align-items-center gap-2">
                            <img
                              src={selectedAsset?.icon || placeholderAssetIcon}
                              alt={selectedAsset?.name}
                              className="rounded-circle"
                              style={{ width: "30px", height: "30px" }}
                            />
                            {selectedAsset?.asset_name} ({selectedAsset?.name})
                          </div>
                        )
                      }
                      dropdownLabel="Select Asset"
                      options={uniqueAssets}
                      enableSearch={true}
                      isLoading={isLoadingTokens}
                      onSelect={handleAssetSelect}
                      searchPlaceholder="Search assets"
                      renderOption={(asset) => (
                        <div className="d-flex align-items-center gap-2">
                          <img
                            src={asset.icon || placeholderAssetIcon}
                            alt={asset.name}
                            className="rounded-circle"
                            style={{ width: "30px", height: "30px" }}
                          />
                          <div>
                            {asset.asset_name}
                            <div className="text-secondary text-sm">
                              {asset.name}
                            </div>
                          </div>
                        </div>
                      )}
                    />
                  </div>
                ) : (
                  <div className="text-secondary h5 fw-bold mb-0">
                    Select Asset
                  </div>
                )}
              </div>
            </div>

            {/* Step 2: Select Network */}
            <div
              className="d-flex align-items-start gap-3 w-100"
              style={{ marginBottom: "2rem" }}
            >
              <div style={{ position: "relative", zIndex: 2 }}>
                <StepIndicator
                  step={2}
                  isActive={currentStep === 2}
                  isCompleted={currentStep > 2}
                />
              </div>
              <div className="flex-1">
                {currentStep >= 2 && selectedAsset ? (
                  <div className="d-flex flex-column gap-2">
                    <div className="h5 fw-bold mb-0">Select Network</div>
                    <DropdownWithModal
                      modalTitle="Select Network"
                      selectedElement={
                        selectedNetworkFullInfo?.id && (
                          <div className="d-flex align-items-center gap-2">
                            <img
                              src={
                                selectedNetworkFullInfo.icon ||
                                placeholderNetworkIcon
                              }
                              alt={selectedNetworkFullInfo.id}
                              className="rounded-circle"
                              style={{ width: "30px", height: "30px" }}
                            />
                            {selectedNetworkFullInfo.name}
                          </div>
                        )
                      }
                      dropdownLabel="Select Network"
                      options={networksForSelectedAssetDropdown}
                      enableSearch={true}
                      onSelect={handleNetworkSelect}
                      searchPlaceholder="Search networks"
                      renderOption={(option) => (
                        <div className="d-flex align-items-center gap-2">
                          <img
                            src={option.icon || placeholderNetworkIcon}
                            alt={option.name}
                            className="rounded-circle"
                            style={{ width: "30px", height: "30px" }}
                          />
                          {option.name}
                        </div>
                      )}
                    />
                  </div>
                ) : (
                  <div className="text-secondary h5 fw-bold mb-0">
                    Select Network
                  </div>
                )}
              </div>
            </div>

            {/* Step 3: Deposit Address */}
            <div className="d-flex align-items-start gap-3 w-100">
              <div style={{ position: "relative", zIndex: 2 }}>
                <StepIndicator
                  step={3}
                  isActive={currentStep === 3}
                  isCompleted={intentsDepositAddress !== ""}
                />
              </div>
              <div className="flex-1 w-75">
                {currentStep >= 3 &&
                selectedAsset &&
                selectedNetworkFullInfo ? (
                  <div className="d-flex flex-column gap-2">
                    <div className="h5 fw-bold mb-0">Deposit Address</div>
                    <div className="text-secondary">
                      Always double-check your deposit address — it may change
                      without notice.
                    </div>
                    {isLoadingAddress ? (
                      <div className="d-flex flex-column gap-2">
                        <Skeleton
                          className="w-100 rounded-3"
                          style={{ height: "80px" }}
                        />
                      </div>
                    ) : intentsDepositAddress ? (
                      <DepositAddress
                        address={intentsDepositAddress}
                        warningMessage={`Only deposit from the ${selectedNetworkFullInfo.name} network.`}
                      />
                    ) : null}
                  </div>
                ) : (
                  <div className="text-secondary h5 fw-bold mb-0">
                    Deposit Address
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="d-flex flex-column gap-2" style={{ maxWidth: "500px" }}>
        <FAQSection faqItems={faqItems} />

        <div className="d-flex gap-2 justify-content-center">
          <div className="text-secondary">Still have questions?</div>
          <a
            className="text-primary"
            target="_blank"
            rel="noopener noreferrer"
            href={"https://docs.neartreasury.com/payments/intents"}
          >
            Learn More
          </a>
        </div>
      </div>
    </div>
  );
};

export default Intents;
