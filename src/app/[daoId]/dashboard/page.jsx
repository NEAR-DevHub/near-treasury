"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useDao } from "@/context/DaoContext";
import Portfolio from "@/app/[daoId]/dashboard/Portfolio";
import Chart from "@/components/ui/Chart";
import IntentsPortfolio from "@/app/[daoId]/dashboard/IntentsPortfolio";
import TransactionHistory from "@/app/[daoId]/dashboard/TransactionHistory";
import FtLockupPortfolio from "@/app/[daoId]/dashboard/FtLockupPortfolio";
import Intents from "@/app/[daoId]/dashboard/intents-deposit/Intents";
import SputnikDao from "@/app/[daoId]/dashboard/intents-deposit/SputnikDao";
import {
  getNearPrice,
  getHistoricalData,
  getIntentsHistoricalData,
} from "@/api/backend";
import Skeleton from "@/components/ui/Skeleton";
import Big from "big.js";
import Tooltip from "@/components/ui/Tooltip";

const Dashboard = () => {
  const searchParams = useSearchParams();
  const depositType = searchParams.get("deposit");

  const {
    daoId,
    lockupContract,
    daoNearBalances,
    daoFtBalances,
    daoStakedBalances,
    lockupStakedBalances,
    lockupContractState,
    lockupNearBalances,
    ftLockups,
  } = useDao();

  // DAO Portfolio chart data
  const [portfolioData, setPortfolioData] = useState({});
  const [portfolioLoading, setPortfolioLoading] = useState(false);
  const [selectedToken, setSelectedToken] = useState("near");
  const [nearPrice, setNearPrice] = useState(0);

  // Lockup chart data
  const [lockupData, setLockupData] = useState({});
  const [lockupLoading, setLockupLoading] = useState(false);

  // Intents chart data
  const [intentsData, setIntentsData] = useState({});
  const [intentsLoading, setIntentsLoading] = useState(false);
  const [selectedIntentsToken, setSelectedIntentsToken] = useState(null);
  const [availableTokens, setAvailableTokens] = useState([]);
  const [intentsTotalUsdBalance, setIntentsTotalUsdBalance] = useState("0");

  // FT lockup state
  const [isFtLockupCollapsed, setIsFtLockupCollapsed] = useState(true);
  const [ftLockupBalance, setFtLockupBalance] = useState(null);

  const [refreshData, setRefreshData] = useState(false);

  // Fetch portfolio chart data
  const fetchPortfolioData = async (token = selectedToken) => {
    setPortfolioLoading(true);
    try {
      const data = await getHistoricalData(daoId, token);
      setPortfolioData(data);
    } catch (error) {
      console.error("Error fetching portfolio data:", error);
    } finally {
      setPortfolioLoading(false);
    }
  };

  const fetchLockupHistoricalData = async (token = "near") => {
    setLockupLoading(true);
    try {
      const data = await getHistoricalData(lockupContract, token);
      setLockupData(data);
    } catch (error) {
      console.error("Error fetching lockup historical data:", error);
    } finally {
      setLockupLoading(false);
    }
  };

  // Fetch intents chart data
  const fetchIntentsData = async () => {
    setIntentsLoading(true);
    try {
      const data = await getIntentsHistoricalData(daoId);
      setIntentsData(data);

      // Extract available tokens from the latest period data (1H)
      if (data && data["1H"] && data["1H"].length > 0) {
        const latestData = data["1H"][data["1H"].length - 1];
        if (latestData.tokens) {
          const tokens = latestData.tokens.map((token) => ({
            contract: token.token_id,
            ft_meta: { symbol: token.symbol },
          }));
          setAvailableTokens(tokens);
          if (!selectedIntentsToken && tokens.length > 0) {
            setSelectedIntentsToken(tokens[0].contract);
          }
        }
      }
    } catch (error) {
      console.error("Error fetching intents data:", error);
    } finally {
      setIntentsLoading(false);
    }
  };

  // Handle token changes in chart
  const handlePortfolioTokenChange = (token) => {
    setSelectedToken(token);
    fetchPortfolioData(token);
  };

  const handleIntentsTokenChange = (token) => {
    setSelectedIntentsToken(token);
  };

  const fetchNearPrice = async () => {
    try {
      // Fetch NEAR price
      const price = await getNearPrice();
      if (typeof price === "number") {
        setNearPrice(price);
      }
    } catch (error) {
      console.error("Error fetching additional data:", error);
    }
  };

  // Format currency function
  const formatCurrency = (amount) => {
    return Number(amount).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  // Calculate total balance
  const totalBalance = Big(daoNearBalances?.totalParsed ?? "0")
    .mul(nearPrice ?? 1)
    .plus(Big(daoStakedBalances?.totalParsed ?? "0").mul(nearPrice ?? 1))
    .plus(Big(lockupNearBalances?.totalParsed ?? "0").mul(nearPrice ?? 1))
    .plus(Big(daoFtBalances?.totalCumulativeAmt ?? "0"))
    .plus(Big(intentsTotalUsdBalance ?? "0"))
    .plus(Big(ftLockupBalance ?? "0"))
    .toFixed(2);

  useEffect(() => {
    if (daoId) {
      fetchPortfolioData();
      fetchIntentsData();
      fetchNearPrice();
    }
  }, [daoId, refreshData]);

  useEffect(() => {
    if (lockupContract) {
      fetchLockupHistoricalData();
    }
  }, [lockupContract]);

  // If deposit parameter is present, show deposit page
  if (depositType) {
    return (
      <div className="w-100 h-100">
        <div className="container-fluid px-3 py-4">
          <div className="d-flex flex-column gap-4">
            <div
              className="mx-auto"
              style={{
                maxWidth: depositType === "sputnik-dao" ? "800px" : "1200px",
                width: "100%",
              }}
            >
              <div className="d-flex flex-column gap-3">
                <div className="d-flex justify-content-center align-items-center position-relative">
                  <button
                    className="btn btn-outline-secondary d-flex gap-1 align-items-center position-absolute start-0"
                    onClick={() => {
                      window.history.pushState({}, "", `/${daoId}/dashboard`);
                      window.dispatchEvent(new PopStateEvent("popstate"));
                    }}
                  >
                    <i className="bi bi-arrow-left"></i> Back
                  </button>
                  <div className="h3 mb-0">Deposit</div>
                </div>
                {depositType === "sputnik-dao" ? <SputnikDao /> : <Intents />}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="container-fluid px-3 py-4">
        <div className="row g-4">
          {/* Left Column - Portfolio (30% on large screens, full width on small) */}
          <div className="col-12 col-lg-4">
            <div className="d-flex flex-column gap-3">
              {/* Total Balance Card */}
              <div className="card card-body">
                <div className="h6 text-secondary">Total Balance</div>

                {nearPrice === null || daoFtBalances === null ? (
                  <Skeleton className="h3 mb-0" />
                ) : (
                  <>
                    <div className="fw-bold h3 mb-0">
                      <span data-testid="total-balance">
                        {formatCurrency(totalBalance)} USD
                      </span>
                      <div className="mt-2">
                        <div className="dropdown w-100">
                          <button
                            className="btn theme-btn w-100"
                            type="button"
                            data-bs-toggle="dropdown"
                            aria-expanded="false"
                            data-testid="deposit-btn"
                          >
                            Deposit
                          </button>
                          <ul className="dropdown-menu dropdown-menu-end dropdown-menu-lg-start px-2 shadow w-100">
                            <li
                              className="dropdown-item cursor-pointer py-2"
                              onClick={() => {
                                const params = new URLSearchParams(
                                  window.location.search
                                );
                                params.set("deposit", "sputnik-dao");
                                window.history.pushState(
                                  {},
                                  "",
                                  `?${params.toString()}`
                                );
                              }}
                            >
                              Sputnik DAO
                              <div className="text-secondary text-sm mt-1">
                                Manage tokens: payments, staking, swaps &
                                lockups
                              </div>
                            </li>
                            <li
                              className="dropdown-item cursor-pointer py-2"
                              onClick={() => {
                                const params = new URLSearchParams(
                                  window.location.search
                                );
                                params.set("deposit", "intents");
                                window.history.pushState(
                                  {},
                                  "",
                                  `?${params.toString()}`
                                );
                              }}
                            >
                              Intents
                              <div className="text-secondary text-sm mt-1">
                                Cross-chain tokens & payments only
                              </div>
                            </li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Portfolio Component */}
              <Portfolio
                ftTokens={daoFtBalances?.fts ? daoFtBalances.fts : null}
                nearStakedTokens={daoStakedBalances?.staked}
                nearUnStakedTokens={daoStakedBalances?.unstaked}
                nearPrice={nearPrice}
                nearStakedTotalTokens={daoStakedBalances?.total}
                nearBalances={daoNearBalances}
                nearWithdrawTokens={daoStakedBalances?.availableToWithdraw}
                heading={
                  <div className="d-flex flex-column gap-1 px-3 pt-3 pb-2">
                    <div className="h5 mb-0">Sputnik DAO</div>
                    <div>
                      <span className="text-sm text-secondary">Wallet: </span>
                      <span className="text-primary text-sm fw-medium">
                        {daoId}
                      </span>
                    </div>
                  </div>
                }
              />

              {/* Intents Portfolio */}
              <IntentsPortfolio
                onTotalBalanceChange={setIntentsTotalUsdBalance}
                treasuryDaoID={daoId}
                heading={
                  <div className="px-3 pt-3 pb-2">
                    <div className="d-flex align-items-center gap-2">
                      <div className="h5 mb-0">NEAR Intents </div>
                      <Tooltip tooltip="The total token amount includes all transfers across different networks. Network details are available below in the distribution section." />
                    </div>
                  </div>
                }
              />

              {lockupContract && (
                <Portfolio
                  ftTokens={[]}
                  isLockupContract={true}
                  lockupState={lockupContractState}
                  nearStakedTokens={lockupStakedBalances?.staked}
                  nearUnStakedTokens={lockupStakedBalances?.unstaked}
                  nearPrice={nearPrice}
                  nearWithdrawTokens={lockupStakedBalances?.availableToWithdraw}
                  nearBalances={lockupNearBalances}
                  nearStakedTotalTokens={lockupStakedBalances?.total}
                  heading={
                    <div className="d-flex flex-column gap-1 px-3 pt-3 pb-2">
                      <div className="h5 mb-0">NEAR Lockup</div>
                      <div>
                        <span className="text-sm text-secondary">Wallet: </span>
                        <span className="text-primary text-sm fw-medium">
                          {lockupContract}
                        </span>
                      </div>
                    </div>
                  }
                />
              )}
              {ftLockups?.partiallyClaimed?.map((ftLockup) => (
                <FtLockupPortfolio
                  key={ftLockup.contractId}
                  contractId={ftLockup.contractId}
                  metadata={ftLockup}
                  treasuryDaoID={daoId}
                  setFtLockupBalance={(balance) => {
                    setFtLockupBalance((prev) =>
                      Big(prev ?? 0)
                        .plus(balance)
                        .toFixed()
                    );
                  }}
                  refreshData={() => setRefreshData(!refreshData)}
                />
              ))}

              {/* Fully claimed FT lockups - collapsible */}
              {ftLockups?.fullyClaimed?.length > 0 && (
                <div className="d-flex flex-column gap-2">
                  <div className="collapse" id="hidden-ft-lockup">
                    {ftLockups?.fullyClaimed?.map((ftLockup) => (
                      <FtLockupPortfolio
                        key={ftLockup.contractId}
                        contractId={ftLockup.contractId}
                        treasuryDaoID={daoId}
                        metadata={ftLockup}
                      />
                    ))}
                  </div>
                  <button
                    className="btn btn-outline-secondary w-100"
                    type="button"
                    data-bs-toggle="collapse"
                    data-bs-target="#hidden-ft-lockup"
                    aria-expanded={!isFtLockupCollapsed}
                    aria-controls="hidden-ft-lockup"
                    onClick={() => setIsFtLockupCollapsed(!isFtLockupCollapsed)}
                  >
                    {isFtLockupCollapsed
                      ? "Show Archived FT Lockup Accounts"
                      : "Show Less"}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Charts (70% on large screens, full width on small) */}
          <div className="col-12 col-lg-8">
            <div className="d-flex flex-column gap-3">
              {/* DAO Historical Graph */}
              <Chart
                title="Sputnik DAO"
                accountId={daoId}
                nearPrice={nearPrice}
                ftTokens={daoFtBalances?.fts ? daoFtBalances.fts : null}
                nearBalance={daoNearBalances?.totalParsed ?? "0"}
                allPeriodData={portfolioData}
                isLoading={portfolioLoading}
                tokenSelector={true}
                periodSelector={true}
                onTokenChange={handlePortfolioTokenChange}
              />

              {/* Intents Historical Graph */}
              {availableTokens.length > 0 && (
                <Chart
                  title="Intents"
                  accountId={daoId}
                  allPeriodData={intentsData}
                  isLoading={intentsLoading}
                  tokenSelector={true}
                  periodSelector={true}
                  customTokens={availableTokens}
                  onTokenChange={handleIntentsTokenChange}
                />
              )}

              {/* NEAR Lockup Historical Graph */}
              {lockupContract && (
                <Chart
                  title="Lockup"
                  accountId={lockupContract}
                  nearPrice={nearPrice}
                  ftTokens={[]}
                  nearBalance={lockupStakedBalances?.totalParsed ?? "0"}
                  allPeriodData={lockupData}
                  isLoading={lockupLoading}
                  tokenSelector={true}
                  periodSelector={true}
                  onTokenChange={() => {}}
                />
              )}
              <TransactionHistory
                treasuryDaoID={daoId}
                lockupContract={lockupContract}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
