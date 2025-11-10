"use client";

import { useEffect, useMemo } from "react";
import { useDao } from "@/context/DaoContext";
import DropdownWithModal from "@/components/dropdowns/DropdownWithModal";
import NearToken from "@/components/icons/NearToken";
import {
  formatTokenBalance,
  convertBalanceToReadableFormat,
  formatTokenAmount,
} from "@/helpers/nearHelpers";

/**
 * Optimized TokensDropdown Component
 * Dropdown for selecting tokens (NEAR, FTs, Intents) based on selected wallet
 *
 * @param {string} selectedValue - Currently selected token ID
 * @param {Function} onChange - Callback when token changes
 * @param {Function} setSelectedTokenBlockchain - Callback to set token blockchain
 * @param {Function} setTokensAvailable - Callback to set available token balance
 * @param {Function} setSelectedTokenIsIntent - Callback to set if token is intent-based
 * @param {string} selectedWallet - Currently selected wallet (SputnikDAO, Lockup, or Intents)
 * @param {boolean} disabled - Disable the dropdown
 */
const TokensDropdown = ({
  selectedValue,
  onChange,
  setSelectedTokenBlockchain,
  setTokensAvailable,
  setSelectedTokenIsIntent,
  selectedWallet,
  disabled = false,
}) => {
  const {
    daoId,
    lockupContract,
    daoNearBalances,
    daoFtBalances,
    lockupNearBalances,
    daoStakedBalances,
    lockupStakedBalances,
    intentsBalances,
  } = useDao();

  // Get wallet configuration based on selected wallet
  const walletConfig = useMemo(() => {
    if (selectedWallet === "intents.near") {
      return {
        account: daoId,
        showIntentsTokens: true,
        nearBalances: { availableParsed: "0" },
        ftTokens: [],
      };
    } else if (selectedWallet === lockupContract) {
      return {
        account: lockupContract,
        showNear: true,
        showLockedNear: true,
        nearBalances: lockupNearBalances,
        ftTokens: [],
        isLockup: true,
      };
    } else {
      // SputnikDAO (default)
      return {
        account: daoId,
        showNear: true,
        showFTTokens: true,
        nearBalances: daoNearBalances,
        ftTokens: daoFtBalances?.fts || [],
      };
    }
  }, [
    selectedWallet,
    daoId,
    lockupContract,
    daoNearBalances,
    daoFtBalances,
    lockupNearBalances,
  ]);

  // Filter tokens with balance and remove spam
  const tokensWithBalance = useMemo(() => {
    return (walletConfig.ftTokens || []).filter(
      (token) =>
        parseFloat(token.amount) > 0 &&
        token.contract !== "Near" &&
        token.ft_meta?.symbol?.length < 30
    );
  }, [walletConfig.ftTokens]);

  // Format intents balances from context
  const formattedIntentsTokens = useMemo(() => {
    if (!intentsBalances || !walletConfig.showIntentsTokens) {
      return [];
    }

    return intentsBalances.map((token) => ({
      icon: token.ft_meta?.icon || null,
      title: token.ft_meta.symbol,
      tokenId: token.contract_id,
      value: `intents_${token.contract_id}`,
      tokenBalance: formatTokenAmount(
        convertBalanceToReadableFormat(token.amount, token.ft_meta.decimals),
        token.ft_meta.price
      ),
      blockchain: token.blockchain,
      isIntent: true,
    }));
  }, [intentsBalances, walletConfig.showIntentsTokens]);

  // Build options array
  const options = useMemo(() => {
    let tokens = [];

    // Add NEAR token if configured
    if (walletConfig.showNear) {
      tokens.push({
        icon: <NearToken height={30} width={30} />,
        title: "NEAR",
        value: "NEAR",
        tokenBalance: walletConfig.nearBalances?.availableParsed || "0",
        blockchain: null,
      });
    }

    // Add FT tokens if configured
    if (walletConfig.showFTTokens) {
      tokens = tokens.concat(
        tokensWithBalance.map((token) => ({
          icon: token.ft_meta.icon,
          title: token.ft_meta.symbol,
          value: token.contract,
          blockchain: null,
          tokenBalance: formatTokenAmount(
            convertBalanceToReadableFormat(
              token.amount,
              token.ft_meta.decimals
            ),
            token.ft_meta.price
          ),
        }))
      );
    }

    // Add Intents tokens if configured
    if (walletConfig.showIntentsTokens) {
      tokens = tokens.concat(formattedIntentsTokens);
    }

    return tokens;
  }, [walletConfig, tokensWithBalance, formattedIntentsTokens]);

  // Get staked tokens for display
  const stakedTokens = walletConfig.isLockup
    ? lockupStakedBalances?.total
    : daoStakedBalances?.total;

  // Find selected option
  const selectedOption = useMemo(() => {
    // Try exact match first
    let option = options.find((i) => i.value === selectedValue);

    // If not found and selectedValue doesn't start with "intents_",
    // try matching against tokenId for intent tokens
    if (!option && selectedValue) {
      option = options.find((i) => i.isIntent && i.tokenId === selectedValue);
    }

    return option || null;
  }, [options, selectedValue]);

  // Handle option selection
  const handleSelect = (option) => {
    onChange(option.isIntent ? option.tokenId : option.value);
    setSelectedTokenBlockchain(option.blockchain);
    setSelectedTokenIsIntent(option.isIntent || false);
    setTokensAvailable(option.tokenBalance);
  };

  // Update available balance when selected value changes
  useEffect(() => {
    if (selectedValue && selectedOption) {
      setTokensAvailable(selectedOption.tokenBalance);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedValue, selectedOption]);

  // Item component for rendering token option
  const renderTokenOption = (option) => {
    return (
      <div className="d-flex gap-3 align-items-center w-100">
        {typeof option.icon === "string" ? (
          <img
            src={option.icon}
            height={30}
            width={30}
            className="rounded-circle"
            alt={option.title}
          />
        ) : typeof option.icon === "function" ? (
          <option.icon />
        ) : (
          option.icon
        )}

        <div className="d-flex flex-column gap-1 w-100 text-wrap text-left">
          <div className="h6 mb-0">{option.title}</div>
          {option.value === "NEAR" && (
            <div className="d-flex flex-column gap-1 w-100 text-wrap text-sm text-secondary">
              <div>
                Tokens locked for storage:{" "}
                {walletConfig.nearBalances?.storageParsed || "0"}
              </div>
              {stakedTokens && (
                <div>Tokens staked: {formatTokenBalance(stakedTokens)}</div>
              )}
            </div>
          )}
          <div className="text-sm text-secondary w-100 text-wrap">
            Tokens available: {option.tokenBalance}{" "}
            {option.isIntent &&
              "through " + (option.blockchain || "").toUpperCase()}
          </div>
        </div>
      </div>
    );
  };

  // Render selected element
  const selectedElement = selectedOption
    ? renderTokenOption(selectedOption)
    : null;

  return (
    <DropdownWithModal
      modalTitle="Select Token"
      options={options}
      onSelect={handleSelect}
      renderOption={renderTokenOption}
      dropdownLabel="Select token"
      selectedElement={selectedElement}
      disabled={disabled}
      isLoading={!Array.isArray(options) || options.length === 0}
      emptyMessage="No tokens available"
      dataTestId="tokens-dropdown"
      enableSearch={true}
      searchPlaceholder="Search tokens..."
    />
  );
};

export default TokensDropdown;
