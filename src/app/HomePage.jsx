"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useNearWallet } from "@/context/NearWalletContext";
import { getUserTreasuries } from "@/helpers/treasuryHelpers";
import { getNearPrice, getFtTokens } from "@/api/backend";
import { Near } from "@/api/near";
import { accountToLockup, formatNearAmount } from "@/helpers/nearHelpers";
import NearToken from "@/components/icons/NearToken";
import Big from "big.js";
import Skeleton from "@/components/ui/Skeleton";

const HomePage = () => {
  const { accountId } = useNearWallet();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [userTreasuries, setUserTreasuries] = useState(null);
  const [nearPrice, setNearPrice] = useState(null);
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    getNearPrice().then((data) => {
      setNearPrice(data);
    });
  }, []);

  useEffect(() => {
    if (accountId) {
      getUserTreasuries(accountId).then((results) => {
        setUserTreasuries(results);
      });
    }
  }, [accountId]);

  // Check for invalid DAO error and show toast
  useEffect(() => {
    const error = searchParams.get("error");
    if (error === "invalid-dao") {
      setShowToast(true);
      // Clean up URL
      router.replace("/");
    }
  }, [searchParams, router]);

  const defaultImage =
    "https://ipfs.near.social/ipfs/bafkreia5drpo7tfsd7maf4auxkhatp6273sunbg7fthx5mxmvb2mooc5zy";

  const BalanceComponent = ({ daoId }) => {
    const [balance, setBalance] = useState(null);
    const [ftTokens, setFtTokens] = useState(null);

    useEffect(() => {
      const fetchBalance = async () => {
        try {
          // Get NEAR balance
          const accountData = await Near.viewAccount(daoId);
          const nearBalance = accountData?.amount;
          const nearBalanceParsed = formatNearAmount(nearBalance);
          // Get FT tokens
          const tokens = await getFtTokens(daoId);
          setFtTokens(tokens);

          const nearBalanceUSD = Big(nearBalanceParsed).mul(nearPrice || "0");
          const totalBalance = Number(
            nearBalanceUSD
              .plus(Big(tokens?.totalCumulativeAmt ?? "0"))
              .toFixed(2)
          ).toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          });

          setBalance(totalBalance);
        } catch (error) {
          console.error("Error fetching balance:", error);
          setBalance("0.00");
        }
      };

      if (daoId && nearPrice !== null) {
        fetchBalance();
      }
    }, [daoId, nearPrice]);

    const maxShow = 3;

    return (
      <div className="d-flex w-100 align-items-center justify-content-between">
        <div className="d-flex flex-column gap-1">
          <div className="text-secondary">Total Balance</div>
          <div className="h6 mb-0 fw-bold">
            {balance !== null ? (
              `$${balance}`
            ) : (
              <Skeleton
                className="rounded-3 w-100"
                style={{ height: "24px" }}
              />
            )}
          </div>
        </div>
        {ftTokens && (
          <div className="d-flex align-items-center">
            {(ftTokens?.fts ?? []).slice(0, maxShow - 1).map((token, index) => (
              <div
                key={token.contract}
                style={{
                  marginLeft: index > 0 ? "-10px" : 0,
                  zIndex: index,
                  backgroundImage: `url("${token.ft_meta.icon}")`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  height: "32px",
                  width: "32px",
                }}
                className="rounded-circle"
              />
            ))}

            <div
              key="near"
              style={{
                marginLeft: ftTokens?.fts?.length > 0 ? "-10px" : 0,
                zIndex: maxShow,
              }}
            >
              <NearToken width="32" height="32" />
            </div>

            {ftTokens?.fts.length > maxShow && (
              <div
                style={{
                  marginLeft: "-15px",
                  zIndex: 999,
                  width: "35px",
                  height: "35px",
                  backgroundColor: "var(--grey-04)",
                }}
                className="rounded-circle d-flex justify-content-center align-items-center"
              >
                +{ftTokens.fts.length - (maxShow - 1)}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const Loader = () => {
    return (
      <div className="row g-4 mt-3">
        {[1, 2, 3].map((i) => (
          <div className="col-md-4" key={i}>
            <div className="card">
              <div className="card-body d-flex gap-3 align-items-center">
                <div
                  style={{
                    height: 55,
                    width: 55,
                    background: "var(--grey-04)",
                    animation: "pulse 1.5s ease-in-out infinite",
                  }}
                  className="rounded-3"
                />
                <div className="d-flex flex-column gap-2">
                  <div
                    style={{
                      height: 22,
                      width: 120,
                      background: "var(--grey-04)",
                      animation: "pulse 1.5s ease-in-out infinite",
                    }}
                    className="rounded-3"
                  />
                  <div
                    style={{
                      height: 20,
                      width: 60,
                      background: "var(--grey-04)",
                      animation: "pulse 1.5s ease-in-out infinite",
                    }}
                    className="rounded-3"
                  />
                </div>
              </div>
              <div className="border-top card-body">
                <div
                  style={{
                    height: 35,
                    background: "var(--grey-04)",
                    animation: "pulse 1.5s ease-in-out infinite",
                  }}
                  className="rounded-3"
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const TreasuryCard = ({ treasury }) => {
    const [lockupContract, setLockupContract] = useState(null);

    useEffect(() => {
      accountToLockup(treasury.daoId).then((lockup) => {
        if (lockup) {
          setLockupContract(lockup);
        }
      });
    }, [treasury.daoId]);

    return (
      <div
        className="card h-100 w-100 d-flex flex-column cursor-pointer text-color"
        style={{
          transition: "transform 0.2s ease, box-shadow 0.2s ease",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "translateY(-4px)";
          e.currentTarget.style.boxShadow = "0 8px 16px rgba(0, 0, 0, 0.2)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "translateY(0)";
          e.currentTarget.style.boxShadow = "";
        }}
        onClick={() => {
          router.push(`/${treasury.daoId}/dashboard`);
        }}
      >
        <div
          className="p-3 d-flex gap-3 align-items-center"
          style={{ height: "80px" }}
        >
          <img
            src={
              (treasury.config.metadata?.flagLogo ?? "")?.includes("ipfs")
                ? treasury.config.metadata?.flagLogo
                : defaultImage
            }
            width={48}
            height={48}
            className="rounded-3 object-fit-cover"
            alt={treasury.config.name}
          />
          <div className="d-flex flex-column">
            <div className="h6 mb-0">{treasury.config.name}</div>
            <div className="text-secondary text-sm">@{treasury.daoId}</div>
          </div>
        </div>

        <div className="border-top flex-grow-1 p-3 d-flex flex-column gap-3">
          <div className="d-flex flex-column gap-1">
            <div>
              <label>Sputnik DAO:</label>
              <span className="fw-semi-bold ms-1 text-primary">
                {treasury.daoId}
              </span>
            </div>
            {lockupContract && (
              <div>
                <label>Lockup:</label>
                <span className="fw-semi-bold ms-1 text-primary">
                  {lockupContract}
                </span>
              </div>
            )}
          </div>

          <div className="mt-auto d-flex flex-column gap-3">
            <div className="border border-1 p-3 rounded-3 d-flex flex-column gap-2">
              <BalanceComponent daoId={treasury.daoId} />
            </div>
          </div>
        </div>
      </div>
    );
  };

  const TreasuryCardList = ({ treasuries }) => {
    if (!Array.isArray(treasuries) || treasuries.length === 0) return null;

    return (
      <div className="row g-4">
        {treasuries.map((treasury) => (
          <div className="col-md-4" key={treasury.daoId}>
            <TreasuryCard treasury={treasury} />
          </div>
        ))}
      </div>
    );
  };

  // Show login message when not logged in
  if (!accountId) {
    return (
      <>
        <div className="d-flex flex-column align-items-center justify-content-center w-100 mb-4 px-3 mt-5 pt-5">
          <div className="text-center">
            <i
              className="bi bi-wallet2 mb-3"
              style={{ fontSize: "4rem", color: "var(--text-color)" }}
            ></i>
            <h3 className="mb-3">Welcome to NEAR Treasury</h3>
            <p className="text-secondary">
              Please sign in with your NEAR wallet to view your treasuries
            </p>
          </div>
        </div>

        {/* Toast notification */}
        <div
          className="position-fixed bottom-0 end-0 p-3"
          style={{ zIndex: 11 }}
        >
          <div
            className={`toast ${showToast ? "show" : ""}`}
            role="alert"
            aria-live="assertive"
            aria-atomic="true"
          >
            <div className="toast-header">
              <i className="bi bi-exclamation-circle-fill text-danger me-2"></i>
              <strong className="me-auto">Invalid Link</strong>
              <button
                type="button"
                className="btn-close"
                onClick={() => setShowToast(false)}
                aria-label="Close"
              ></button>
            </div>
            <div className="toast-body">
              Invalid link. Please check the URL or address you entered and try
              again.
            </div>
          </div>
        </div>
      </>
    );
  }

  // Show treasuries when logged in
  return (
    <>
      <div className="d-flex flex-column align-items-center w-100 mb-4 px-3 mt-4">
        <div className="d-flex w-100 align-items-center justify-content-between position-relative mb-3">
          <h3 style={{ fontWeight: 600 }}>My Treasuries</h3>
          <a
            href="https://treasury-factory.near.page/app?page=create"
            target="_blank"
            rel="noopener noreferrer"
          >
            <button className="btn theme-btn d-flex align-items-center gap-2">
              <i className="bi bi-plus-lg"></i>
              Create Treasury
            </button>
          </a>
        </div>
        <div className="d-flex flex-column gap-3 w-100">
          {!Array.isArray(userTreasuries) && <Loader />}
          <div className="d-flex flex-column gap-3">
            <div className="mt-3">
              {Array.isArray(userTreasuries) && userTreasuries.length > 0 && (
                <TreasuryCardList treasuries={userTreasuries} />
              )}

              {Array.isArray(userTreasuries) && userTreasuries.length === 0 && (
                <div className="text-center mt-5 pt-5">
                  <i
                    className="bi bi-inbox mb-3"
                    style={{ fontSize: "3rem", color: "var(--text-secondary)" }}
                  ></i>
                  <h5 className="text-secondary">No Treasuries Found</h5>
                  <br />
                  <p className="text-secondary">
                    You are not a member of any DAOs with treasuries yet.
                    <br /> Create a new treasury to get started.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Toast notification */}
      <div className="position-fixed bottom-0 end-0 p-3" style={{ zIndex: 11 }}>
        <div
          className={`toast ${showToast ? "show" : ""}`}
          role="alert"
          aria-live="assertive"
          aria-atomic="true"
        >
          <div className="toast-header">
            <i className="bi bi-exclamation-circle-fill text-danger me-2"></i>
            <strong className="me-auto">Invalid Link</strong>
            <button
              type="button"
              className="btn-close"
              onClick={() => setShowToast(false)}
              aria-label="Close"
            ></button>
          </div>
          <div className="toast-body">
            Invalid link. Please check the URL or address you entered and try
            again.
          </div>
        </div>
      </div>
    </>
  );
};

export default HomePage;
