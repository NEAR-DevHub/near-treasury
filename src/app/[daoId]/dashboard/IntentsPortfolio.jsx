"use client";

import { useState, useEffect } from "react";
import Skeleton from "@/components/ui/Skeleton";
import NearToken from "@/components/icons/NearToken";
import {
  formatTokenAmount,
  formatUsdValue,
  convertBalanceToReadableFormat,
} from "@/helpers/nearHelpers";
import { formatCurrency } from "@/helpers/formatters";
import { getIntentsBalances } from "@/api/rpc";
import Big from "big.js";

const IntentsPortfolio = ({ treasuryDaoID, heading, onTotalBalanceChange }) => {
  const [tokens, setTokens] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [expandedTokens, setExpandedTokens] = useState({});

  function formatPrice(price) {
    const numAmount = Number(price ?? 0);
    if (numAmount > 0 && numAmount < 0.01) {
      return "< $0.01";
    }
    return formatCurrency(price);
  }

  // Function to aggregate tokens by symbol
  function aggregateTokensBySymbol(tokens) {
    const aggregated = {};

    tokens.forEach((token) => {
      const { symbol, icon, decimals, price } = token.ft_meta;
      const amount = token.amount;

      if (!aggregated[symbol]) {
        aggregated[symbol] = {
          symbol,
          icon,
          decimals,
          price,
          totalAmount: "0",
          tokens: [],
        };
      }

      const readableAmount = convertBalanceToReadableFormat(amount, decimals);
      aggregated[symbol].totalAmount = Big(aggregated[symbol].totalAmount)
        .plus(Big(readableAmount))
        .toString();
      aggregated[symbol].tokens.push({
        ...token,
        readableAmount,
      });
    });

    return Object.values(aggregated);
  }

  useEffect(() => {
    if (!treasuryDaoID) return;
    setLoading(true);
    setError(false); // Reset error state on new fetch
    if (typeof onTotalBalanceChange === "function") {
      onTotalBalanceChange("0"); // Initialize to "0" or signal loading
    }

    getIntentsBalances(treasuryDaoID)
      .then((tokens) => {
        if (tokens.length === 0) {
          setTokens([]);
          setLoading(false);
          return;
        }

        // Aggregate tokens by symbol
        const aggregatedTokens = aggregateTokensBySymbol(tokens);
        setTokens(aggregatedTokens);
        setLoading(false);

        // Calculate and pass up the total USD balance
        if (typeof onTotalBalanceChange === "function") {
          const totalUsd = aggregatedTokens.reduce((acc, token) => {
            const usdValue = Big(token.totalAmount).mul(token.price || 0);
            return acc.plus(usdValue);
          }, Big(0));
          onTotalBalanceChange(totalUsd.toFixed(2));
        }
      })
      .catch((error) => {
        console.error("Error fetching intents balances:", error);
        setError(true);
        setLoading(false);
        setTokens([]);
        if (typeof onTotalBalanceChange === "function") {
          onTotalBalanceChange("0"); // Signal error or zero balance
        }
      });
  }, [treasuryDaoID, onTotalBalanceChange]);

  const Loading = () => (
    <div className="d-flex align-items-center gap-2 w-100 mx-2 mb-2">
      <div style={{ width: "40px" }}>
        <Skeleton
          style={{ height: "40px", width: "40px" }}
          className="rounded-circle"
        />
      </div>
      <div className="d-flex flex-column gap-1" style={{ width: "60%" }}>
        <Skeleton
          style={{ height: "24px", width: "100%" }}
          className="rounded-1"
        />
        <Skeleton
          style={{ height: "16px", width: "100%" }}
          className="rounded-2"
        />
      </div>
      <div className="d-flex flex-column gap-1" style={{ width: "20%" }}>
        <Skeleton
          style={{ height: "24px", width: "100%" }}
          className="rounded-1"
        />
        <Skeleton
          style={{ height: "16px", width: "100%" }}
          className="rounded-2"
        />
      </div>
    </div>
  );

  const TokenCard = ({ token, id }) => {
    const { symbol, icon, price, totalAmount } = token;
    const individualTokens = token.tokens;
    const isExpanded = expandedTokens[symbol] || false;

    const toggleExpanded = () => {
      setExpandedTokens((prev) => ({
        ...prev,
        [symbol]: !prev[symbol],
      }));
    };

    return (
      <div
        className={
          "d-flex flex-column " + (id !== tokens.length - 1 && " border-bottom")
        }
      >
        <div className="py-2 d-flex gap-2 align-items-center justify-content-between px-3">
          <div className="d-flex align-items-center gap-2">
            {icon ? (
              <img
                src={icon}
                height={30}
                width={30}
                className="rounded-circle"
              />
            ) : (
              <NearToken height={30} width={30} />
            )}
            <div>
              <div
                style={{ maxWidth: "240px" }}
                className="h6 mb-0 text-truncate"
              >
                {symbol}
              </div>
              <div className="text-sm text-secondary">{formatPrice(price)}</div>
            </div>
          </div>
          <div className="d-flex gap-2 align-items-center justify-content-end">
            <div className="d-flex flex-column align-items-end">
              <div className="h6 mb-0">
                {formatTokenAmount(totalAmount, price)}
              </div>
              <div className="text-sm text-secondary">
                {formatUsdValue(totalAmount, price)}
              </div>
            </div>
            <div
              style={{
                width: 20,
              }}
            >
              <i
                onClick={toggleExpanded}
                className={
                  (isExpanded ? "bi bi-chevron-up" : "bi bi-chevron-down") +
                  " text-secondary h6 mb-0 cursor-pointer"
                }
              ></i>
            </div>
          </div>
        </div>

        {isExpanded && (
          <div
            className="d-flex flex-column text-color"
            style={{ backgroundColor: "var(--bg-system-color)" }}
          >
            {individualTokens.map((individualToken, idx) => (
              <div
                key={idx}
                className={
                  "d-flex align-items-center justify-content-between px-4 py-2 " +
                  (idx !== individualTokens.length && "border-top")
                }
              >
                <div style={{ paddingLeft: "5px" }}>
                  {individualToken.blockchainName || "" || "Unknown"}
                </div>
                <div className="d-flex justify-content-end">
                  <div className="d-flex flex-column align-items-end">
                    <div className="d-flex gap-1">
                      <div style={{ marginTop: "-5px" }}>
                        {icon ? (
                          <img
                            src={icon}
                            height={16}
                            width={16}
                            className="rounded-circle"
                          />
                        ) : (
                          <NearToken height={16} width={16} />
                        )}
                      </div>
                      <div className="h6 mb-0">
                        {formatTokenAmount(
                          individualToken.readableAmount,
                          price
                        )}
                      </div>
                    </div>

                    <div className="text-sm text-secondary">
                      {formatUsdValue(individualToken.readableAmount, price)}
                    </div>
                  </div>
                  <div
                    style={{
                      width: 20,
                    }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  if (loading)
    return (
      <div className="card flex-1 overflow-hidden border-bottom">
        {heading}
        <Loading />
      </div>
    );
  if (error)
    return (
      <div className="card flex-1 overflow-hidden border-bottom">
        {heading}
        <div className="text-danger px-3 py-2">
          Failed to load Intents balances.
        </div>
      </div>
    );

  const filtered = (tokens || []).filter((token) =>
    Big(token.totalAmount || "0").gt(0)
  );

  return filtered.length > 0 ? (
    <div
      data-testid="intents-portfolio"
      className="card flex-1 overflow-hidden"
    >
      {heading}
      {filtered.map((token, idx) => (
        <TokenCard key={idx} token={token} id={idx} />
      ))}
    </div>
  ) : (
    <></>
  );
};

export default IntentsPortfolio;
