"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Skeleton from "@/components/ui/Skeleton";
import DateTimeDisplay from "@/components/ui/DateTimeDisplay";
import { useTheme } from "@/context/ThemeContext";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Line } from "react-chartjs-2";
import { formatAmountToReadableFormat } from "@/helpers/formatters";
import {
  formatChartDate,
  formatDateTimeWithTimezone,
} from "@/components/ui/DateTimeDisplay";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const Chart = ({
  title,
  accountId,
  nearPrice,
  ftTokens = [],
  allPeriodData = {},
  isLoading = false,
  tokenSelector = true,
  periodSelector = true,
  customTokens = null,
  onTokenChange = null,
  onPeriodChange = null,
}) => {
  const { isDarkTheme } = useTheme();
  const [selectedToken, setSelectedToken] = useState("near");
  const [selectedPeriod, setSelectedPeriod] = useState("1Y");
  const chartRef = useRef(null);

  // Period configuration
  const periodMap = {
    "1H": { value: 1 / 6, interval: 6 },
    "1D": { value: 1, interval: 12 },
    "1W": { value: 24, interval: 8 },
    "1M": { value: 24 * 2, interval: 15 },
    "1Y": { value: 24 * 30, interval: 12 },
    All: { value: 24 * 365, interval: 10 },
  };

  // Memoized tokens list
  const tokens = useMemo(() => {
    const nearToken = {
      contract: "near",
      amount: "0",
      ft_meta: { symbol: "NEAR", price: nearPrice },
    };

    if (customTokens && customTokens.length > 0) {
      return customTokens;
    }

    if (Array.isArray(ftTokens)) {
      const sortedTokens = ftTokens.sort((a, b) => {
        const aValue =
          (parseFloat(a.amount) * (a.ft_meta?.price || 0)) /
          Math.pow(10, a.ft_meta?.decimals ?? 1);
        const bValue =
          (parseFloat(b.amount) * (b.ft_meta?.price || 0)) /
          Math.pow(10, b.ft_meta?.decimals ?? 1);
        return bValue - aValue;
      });
      return [nearToken, ...sortedTokens];
    }

    return [nearToken];
  }, [customTokens, ftTokens, nearPrice]);

  // Set default token on mount and when tokens change
  useEffect(() => {
    if (tokens.length > 0) {
      const defaultToken = customTokens ? tokens[0].contract : "near";
      setSelectedToken(defaultToken);
    }
  }, [tokens, customTokens]);

  // Memoized chart data
  const chartData = useMemo(() => {
    if (!allPeriodData || Object.keys(allPeriodData).length === 0) {
      return { history: [], currentBalance: null };
    }

    const periodData = allPeriodData[selectedPeriod];
    if (!periodData || !Array.isArray(periodData)) {
      return { history: [], currentBalance: null };
    }

    let processedHistory = [];

    if (customTokens && customTokens.length > 0) {
      // Intents data structure
      processedHistory = periodData.map((dataPoint) => {
        const tokenData = dataPoint.tokens?.find(
          (token) => token.token_id === selectedToken
        );
        return {
          timestamp: dataPoint.timestamp,
          balance: tokenData ? parseFloat(tokenData.parsedBalance) : 0,
        };
      });
    } else {
      // Portfolio data structure
      processedHistory = periodData.map((dataPoint) => ({
        timestamp: dataPoint.timestamp,
        balance: parseFloat(dataPoint.balance),
      }));
    }

    const currentBalance =
      processedHistory.length > 0
        ? processedHistory[processedHistory.length - 1]
        : null;

    return { history: processedHistory, currentBalance };
  }, [allPeriodData, selectedPeriod, selectedToken, customTokens]);

  // Handle token change
  const handleTokenChange = (token) => {
    setSelectedToken(token);
    if (onTokenChange) {
      onTokenChange(token);
    }
  };

  // Handle period change
  const handlePeriodChange = (period) => {
    setSelectedPeriod(period);
    if (onPeriodChange) {
      onPeriodChange(period);
    }
  };

  // Get CSS variable helper
  const getCSSVariable = (variable) => {
    if (typeof window !== "undefined") {
      return getComputedStyle(document.documentElement)
        .getPropertyValue(variable)
        .trim();
    }
    return "";
  };

  // Create gradient for chart background
  const createGradient = (ctx, chartArea) => {
    if (!chartArea) return null;

    const gradient = ctx.createLinearGradient(
      0,
      chartArea.top,
      0,
      chartArea.bottom
    );

    if (isDarkTheme) {
      gradient.addColorStop(0, "rgba(255,255,255, 0.2)");
      gradient.addColorStop(0.3, "rgba(255,255,255, 0.1)");
      gradient.addColorStop(1, "rgba(255,255,255, 0)");
    } else {
      gradient.addColorStop(0, "rgba(0,0,0, 0.3)");
      gradient.addColorStop(0.3, "rgba(0,0,0, 0.1)");
      gradient.addColorStop(1, "rgba(0,0,0, 0)");
    }

    return gradient;
  };

  // Get current balance to display
  const displayBalance = chartData.currentBalance;
  const selectedTokenInfo = tokens.find((t) => t.contract === selectedToken);

  // Memoize chart options to prevent infinite re-renders
  const chartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        intersect: false,
        mode: "index",
      },
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          enabled: true,
          backgroundColor: getCSSVariable("--bg-page-color"),
          titleColor: getCSSVariable("--text-color"),
          bodyColor: getCSSVariable("--text-color"),
          borderColor: getCSSVariable("--border-color"),
          borderWidth: 1,
          displayColors: false,
          callbacks: {
            title: (context) => {
              const dataIndex = context[0].dataIndex;
              const dataPoint = chartData.history[dataIndex];
              return dataPoint
                ? formatDateTimeWithTimezone(dataPoint.timestamp)
                : "";
            },
            label: (context) => {
              return `Token Balance: ${formatAmountToReadableFormat(
                context.parsed.y
              )}`;
            },
          },
        },
      },
      layout: {
        padding: {
          top: 10,
          bottom: 10,
          left: 0,
          right: 0,
        },
      },
      scales: {
        x: {
          grid: {
            display: false,
          },
          ticks: {
            display: true,
            color: getCSSVariable("--text-color"),
            maxTicksLimit: chartData.history.length,
          },
        },
        y: {
          display: false,
          grid: {
            display: false,
          },
        },
      },
      animation: {
        duration: 0,
      },
    }),
    [chartData.history, isDarkTheme]
  );

  return (
    <div className="card card-body">
      <div className="d-flex justify-content-between align-items-start mb-3">
        <div className="d-flex flex-column gap-1">
          <h5 className="h5 mb-1">{title}</h5>
          {isLoading || !displayBalance ? (
            <Skeleton
              style={{ height: "24px", width: "120px" }}
              className="rounded-3"
            />
          ) : (
            <div className="d-flex align-items-center gap-2">
              <div className="d-flex flex-column">
                <div className="h4 mb-0 fw-bold">
                  {formatAmountToReadableFormat(displayBalance.balance)}
                  <span className="ms-2">
                    {selectedTokenInfo?.ft_meta?.symbol}
                  </span>
                </div>
              </div>
              <span className="ms-2">
                <DateTimeDisplay timestamp={displayBalance.timestamp} />
              </span>
            </div>
          )}
        </div>

        {periodSelector && (
          <div className="d-flex gap-1 flex-wrap">
            {Object.entries(periodMap).map(
              ([period, { value, interval }], idx) => (
                <button
                  key={`${accountId}-${idx}`}
                  className={`btn btn-sm border-0`}
                  onClick={() => handlePeriodChange(period)}
                  style={{
                    backgroundColor:
                      periodMap[selectedPeriod].value === value &&
                      periodMap[selectedPeriod].interval === interval
                        ? "var(--grey-05)"
                        : "transparent",
                    color:
                      periodMap[selectedPeriod].value === value &&
                      periodMap[selectedPeriod].interval === interval
                        ? "var(--text-color)"
                        : "var(--text-secondary-color)",
                    border: "1px solid var(--border-color)",
                    padding: "4px 12px",
                    borderRadius: "8px",
                    fontSize: "14px",
                  }}
                >
                  {period}
                </button>
              )
            )}
          </div>
        )}
      </div>

      {tokenSelector && tokens && (
        <div className="d-flex gap-4 flex-wrap align-items-center">
          {tokens.slice(0, 5).map((item, _index) => {
            const { contract, ft_meta } = item;
            const { symbol } = ft_meta;

            return (
              <div
                className="d-flex align-items-center"
                key={`${accountId}-${contract}`}
              >
                <input
                  id={`${accountId}-${contract}`}
                  className="form-check-input mt-0"
                  type="radio"
                  value={contract}
                  onChange={() => handleTokenChange(contract)}
                  checked={contract === selectedToken}
                />
                <label
                  htmlFor={`${accountId}-${contract}`}
                  role="button"
                  className="d-flex align-items-center gap-1"
                >
                  <div className="radio-btn">
                    <div
                      className={contract === selectedToken ? "selected" : ""}
                    />
                  </div>
                  <span
                    style={{ maxWidth: 100 }}
                    className={`text-truncate${
                      contract === selectedToken ? " fw-bold" : ""
                    }`}
                  >
                    {symbol}
                  </span>
                </label>
              </div>
            );
          })}
        </div>
      )}

      {isLoading || chartData.history.length === 0 ? (
        <div
          className="w-100 d-flex justify-content-center align-items-center mt-2 rounded-3 overflow-hidden"
          style={{ height: "400px" }}
        >
          <Skeleton className="w-100 h-100 rounded-3" />
        </div>
      ) : (
        <div
          className="w-100 d-flex justify-content-center align-items-center mt-2 rounded-3 overflow-hidden"
          style={{ height: "400px" }}
        >
          <Line
            ref={chartRef}
            data={{
              labels: chartData.history.map((item) =>
                formatChartDate(item.timestamp, selectedPeriod)
              ),
              datasets: [
                {
                  label: "Balance",
                  data: chartData.history.map((item) =>
                    parseFloat(item.balance)
                  ),
                  fill: true,
                  backgroundColor: (context) => {
                    const chart = context.chart;
                    const { ctx, chartArea } = chart;
                    return createGradient(ctx, chartArea);
                  },
                  borderColor: getCSSVariable("--text-color"),
                  pointBackgroundColor: getCSSVariable("--bg-page-color"),
                  pointRadius: 0,
                  tension: 0.2,
                  borderWidth: 1.5,
                },
              ],
            }}
            options={chartOptions}
          />
        </div>
      )}
    </div>
  );
};

export default Chart;
