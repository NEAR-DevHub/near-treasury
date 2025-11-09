"use client";

import { useState, useEffect, useMemo } from "react";
import Big from "big.js";
import { Near } from "@/api/near";
import {
  formatTokenAmount,
  formatTokenBalance,
  formatUsdValue,
} from "@/helpers/nearHelpers";
import { getTokenPrice } from "@/api/backend";
import NearToken from "@/components/icons/NearToken";
import Tooltip from "@/components/ui/Tooltip";
import Skeleton from "@/components/ui/Skeleton";

// Cache for token metadata to prevent re-fetching (shared with TokenIcon)
const tokenMetadataCache = {};

/**
 * TokenAmount Component
 * Displays formatted token amount with icon, symbol, and optional USD value
 * Shows truncated value with tilde (~) when needed, full value on hover
 *
 * @param {string} address - Token contract address (empty or "near" for NEAR)
 * @param {string} symbol - Optional symbol for non-contract tokens
 * @param {string} amountWithDecimals - Amount already in decimal form
 * @param {string} amountWithoutDecimals - Raw amount (will be divided by decimals)
 * @param {boolean} showUSDValue - Show USD value below amount
 * @param {number} price - Optional price to avoid API calls
 */
const TokenAmount = ({
  address = "",
  symbol = null,
  amountWithDecimals = null,
  amountWithoutDecimals = null,
  showUSDValue = false,
  price = null,
  isProposalDetails = false,
  displayAllDecimals = false,
}) => {
  // Handle NEAR Intents token format (e.g., "nep141:btc.omft.near")
  const cleanAddress = useMemo(() => {
    if (address.startsWith("nep141:")) {
      return address.replace("nep141:", "");
    }
    return address;
  }, [address]);

  const isNEAR =
    !symbol && (cleanAddress === "" || cleanAddress.toLowerCase() === "near");
  const isWrapNear = !symbol && cleanAddress === "wrap.near";

  const [ftMetadata, setFtMetadata] = useState(null);
  const [tokenPrice, setTokenPrice] = useState(price);
  const [tokenUSDValue, setTokenUSDValue] = useState(null);

  // Fetch token metadata
  useEffect(() => {
    if (isNEAR) {
      const cachedMetadata = {
        symbol: "NEAR",
        decimals: 24,
        icon: null,
      };
      setFtMetadata(cachedMetadata);
      tokenMetadataCache["near"] = cachedMetadata;
    } else if (isWrapNear) {
      const cachedMetadata = {
        symbol: "wNEAR",
        decimals: 24,
        icon: "https://img.rhea.finance/images/w-NEAR-no-border.png",
      };
      setFtMetadata(cachedMetadata);
      tokenMetadataCache["wrap.near"] = cachedMetadata;
    } else if (symbol) {
      // Symbol-based token (no contract address)
      const cachedMetadata = {
        symbol: symbol,
        decimals: 1,
        icon: null,
      };
      setFtMetadata(cachedMetadata);
      tokenMetadataCache[symbol] = cachedMetadata;
    } else if (cleanAddress) {
      // Check cache first
      if (tokenMetadataCache[cleanAddress]) {
        setFtMetadata(tokenMetadataCache[cleanAddress]);
        return;
      }

      // Fetch from API if not cached
      Near.view(cleanAddress, "ft_metadata", {})
        .then((metadata) => {
          setFtMetadata(metadata);
          tokenMetadataCache[cleanAddress] = metadata; // Cache the result
        })
        .catch((error) => {
          console.error("Error fetching token metadata:", error);
          setFtMetadata(null);
          tokenMetadataCache[cleanAddress] = null; // Cache null to prevent retries
        });
    }
  }, [cleanAddress, isNEAR, isWrapNear, symbol]);

  // Calculate amount
  const { amount, originalAmount } = useMemo(() => {
    if (!ftMetadata) return { amount: "0", originalAmount: "0" };

    let amt = amountWithDecimals;
    let origAmt = amountWithDecimals;

    const hasRawAmount =
      amountWithoutDecimals !== undefined &&
      amountWithoutDecimals !== null &&
      amountWithoutDecimals !== "";
    if (hasRawAmount) {
      try {
        const raw = Big(String(amountWithoutDecimals));
        origAmt = raw.div(Big(10).pow(ftMetadata.decimals ?? 1));
        amt = origAmt.toFixed();
      } catch (e) {
        // Fallback safely when input is not a valid number
        origAmt = Big(0);
        amt = "0";
      }
    }

    return { amount: amt, originalAmount: origAmt };
  }, [amountWithDecimals, amountWithoutDecimals, ftMetadata]);

  // Fetch token price and calculate USD value
  useEffect(() => {
    if (price) {
      setTokenPrice(price);
      if (showUSDValue) {
        setTokenUSDValue(Big(amount).mul(price).toFixed(2));
      }
      return;
    }

    // Fetch price from API
    if (cleanAddress || isNEAR) {
      const tokenAddress = isNEAR ? "" : cleanAddress;
      getTokenPrice(tokenAddress).then((fetchedPrice) => {
        if (fetchedPrice) {
          setTokenPrice(fetchedPrice);
          if (showUSDValue) {
            setTokenUSDValue(Big(amount).mul(fetchedPrice).toFixed(2));
          }
        }
      });
    }
  }, [showUSDValue, cleanAddress, symbol, amount, price, isNEAR]);

  // Format amount for display using common.js utilities
  function toReadableAmount(value, showAllDecimals) {
    if (!value) return "0";

    // Use formatTokenAmount from common.js for smart formatting
    if (!showAllDecimals && tokenPrice) {
      return formatTokenAmount(value, tokenPrice);
    }

    // For full precision display, show all significant decimals
    if (showAllDecimals) {
      try {
        const bigValue = Big(value);
        // Use toFixed without a limit to get full precision
        // Then remove trailing zeros
        const fullPrecision = bigValue.toString();
        const parts = fullPrecision.split(".");
        if (parts[0]) {
          parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
        }
        return parts.join(".");
      } catch {
        return value.toString();
      }
    }

    // Default formatting for regular display
    return formatTokenBalance(value, {
      minAmount: 0.01,
      maxDecimals: 8,
      defaultDecimals: 2,
    });
  }

  // Check if amount is truncated
  const showTilde = useMemo(() => {
    if (!originalAmount) return false;

    const formattedAmount = toReadableAmount(amount, false);
    const cleanFormatted = formattedAmount.replace(/,/g, "");

    return (
      cleanFormatted !== amount &&
      Math.abs(parseFloat(cleanFormatted) - parseFloat(amount)) > 0.0000001
    );
  }, [amount, originalAmount, tokenPrice]);

  if (!ftMetadata) {
    return (
      <Skeleton
        style={{ height: "30px", width: "100%" }}
        className="rounded-3"
      />
    );
  }

  const AmountDisplay = ({ showAllDecimals }) => {
    const formattedAmount = toReadableAmount(
      amount,
      isProposalDetails || showAllDecimals
    );

    return (
      <div className="text-center">
        {isProposalDetails ? (
          <div className="d-flex gap-1 align-items-center h6 mb-0">
            {isNEAR ? (
              <NearToken width={16} height={16} />
            ) : (
              ftMetadata.icon && (
                <img
                  width="16"
                  height="16"
                  src={ftMetadata.icon}
                  alt={ftMetadata.symbol}
                  className="rounded-circle"
                />
              )
            )}
            <span className="fw-bold mb-0">{formattedAmount}</span>

            {ftMetadata.symbol && (
              <span style={{ fontWeight: "normal" }}>{ftMetadata.symbol}</span>
            )}

            {showUSDValue && tokenUSDValue && (
              <div className="text-secondary small">
                ~ {formatUsdValue(amount, tokenPrice)} USD
              </div>
            )}
          </div>
        ) : (
          <div>
            <div className="d-flex gap-1 align-items-center justify-content-end">
              <span className="fw-bold mb-0">
                {(showTilde && !showAllDecimals ? "~" : "") + formattedAmount}
              </span>
              {isNEAR ? (
                <NearToken width={16} height={16} />
              ) : ftMetadata.icon ? (
                <img
                  width="16"
                  height="16"
                  src={ftMetadata.icon}
                  alt={ftMetadata.symbol}
                  className="rounded-circle"
                />
              ) : (
                ftMetadata.symbol && <span>{ftMetadata.symbol}</span>
              )}
            </div>
            {showUSDValue && tokenUSDValue && (
              <div className="text-secondary d-flex justify-content-end small">
                ~ {formatUsdValue(amount, tokenPrice)} USD
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // Show tooltip with full precision on hover
  return (
    <Tooltip tooltip={<AmountDisplay showAllDecimals={true} />}>
      <div>
        <AmountDisplay showAllDecimals={displayAllDecimals} />
      </div>
    </Tooltip>
  );
};

export default TokenAmount;
