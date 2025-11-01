"use client";

import { useMemo } from "react";
import Big from "big.js";
import { formatUsdValue } from "@/helpers/nearHelpers";

/**
 * TokenDisplay Component
 * Displays token with icon, amount, symbol, and USD value
 *
 * @param {string} icon - Token icon URL
 * @param {string} symbol - Token symbol
 * @param {number} price - Token price in USD
 * @param {string} amountWithDecimals - Amount already in decimal form
 * @param {number} decimals - Token decimals (optional)
 * @param {boolean} showUSDValue - Show USD value below amount (default: true)
 * @param {string} networkName - Network name to display
 * @param {string} className - Additional CSS classes
 */
const IntentsTokenDisplay = ({
  networkName,
  icon,
  symbol,
  price,
  amountWithDecimals,
  showUSDValue = true,
  className = "",
  showPrice = true,
}) => {
  // Format amount with full precision
  const formattedAmount = useMemo(() => {
    if (!amountWithDecimals) return "0";

    try {
      // Use Big.js to preserve full precision
      const amount = Big(amountWithDecimals || 0);
      const amountStr = amount.toFixed();

      // Format with commas for thousands separator but keep all decimals
      const parts = amountStr.split(".");
      if (parts[0]) {
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
      }
      return parts.join(".");
    } catch (e) {
      // Fallback if Big.js fails
      return String(amountWithDecimals || "0");
    }
  }, [amountWithDecimals]);

  // Calculate USD value
  const usdValue = useMemo(() => {
    if (!showUSDValue || !price || !amountWithDecimals) return null;
    return formatUsdValue(amountWithDecimals, price);
  }, [amountWithDecimals, price, showUSDValue]);

  // Format price for display
  const formattedPrice = useMemo(() => {
    if (!price) return null;
    return price.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6,
    });
  }, [price]);

  return (
    <div className="d-flex flex-column gap-2">
      <div className={`d-flex gap-1 align-items-center ${className}`}>
        {icon && (
          <img
            width="20"
            height="20"
            src={icon}
            alt={symbol}
            className="rounded-circle object-fit-cover"
          />
        )}
        <div className="text-center">
          <div className="d-flex gap-1 align-items-center justify-content-end">
            <span className="fw-bold mb-0">{formattedAmount}</span>
            {symbol && <span>{symbol}</span>}

            {showUSDValue && usdValue && (
              <div className="text-secondary d-flex small">({usdValue})</div>
            )}
          </div>
        </div>
      </div>
      {networkName && <div className="text-secondary small">{networkName}</div>}
      {showPrice && formattedPrice && symbol && (
        <div className="text-secondary small">
          1 {symbol} = ${formattedPrice}
        </div>
      )}
    </div>
  );
};

export default IntentsTokenDisplay;
