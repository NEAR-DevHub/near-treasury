"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useNearWallet } from "@/context/NearWalletContext";
import { useDao } from "@/context/DaoContext";
import { useProposals } from "@/hooks/useProposals";
import { Near } from "@/api/near";
import { normalize } from "@/helpers/formatters";
import Table from "./Table";
import ProposalDetailsPage from "./ProposalDetailsPage";
import CreateStakeRequest from "./CreateStakeRequest";
import CreateUnstakeRequest from "./CreateUnstakeRequest";
import CreateWithdrawRequest from "./CreateWithdrawRequest";
import Filters from "./Filters";
import ExportTransactions from "@/components/proposals/ExportTransactions";
import OffCanvas from "@/components/ui/OffCanvas";
import Pagination from "@/components/ui/Pagination";
import SettingsDropdown from "@/components/dropdowns/SettingsDropdown";
import StakeIcon from "@/components/icons/StakeIcon";
import UnstakeIcon from "@/components/icons/UnstakeIcon";
import WithdrawIcon from "@/components/icons/WithdrawIcon";

const StakeDelegation = () => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { accountId } = useNearWallet();
  const { daoId: treasuryDaoID, hasPermission } = useDao();

  const tab = searchParams.get("tab");
  const id = searchParams.get("id");

  const [showCreateRequest, setShowCreateRequest] = useState(false);
  const [createRequestType, setCreateRequestType] = useState("stake"); // 'stake', 'unstake', 'withdraw'
  const [showProposalDetailsId, setShowProposalId] = useState(null);
  const [showToastStatus, setToastStatus] = useState(false);
  const [voteProposalId, setVoteProposalId] = useState(null);
  // Derive current tab from URL
  const currentTab = {
    title: tab === "history" ? "History" : "Pending Requests",
  };
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [activeFilters, setActiveFilters] = useState({});
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [sortDirection, setSortDirection] = useState("desc");
  const [amountValues, setAmountValues] = useState({
    min: "",
    max: "",
    equal: "",
    value: "between",
  });
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  const hasCreatePermission = hasPermission?.("call", "AddProposal");

  // Use the proposals hook
  const {
    proposals,
    total: totalLength,
    isLoading,
    invalidateCategory,
  } = useProposals({
    category: "stake-delegation",
    statuses:
      currentTab.title === "Pending Requests"
        ? ["InProgress"]
        : ["Approved", "Rejected", "Expired", "Failed"],
    page,
    pageSize: rowsPerPage,
    sortDirection,
    filters: activeFilters,
    search,
    amountValues,
  });

  const proposalDetailsPageId =
    id || id === "0" || id === 0 ? parseInt(id) : null;

  // Reset page when tab changes
  useEffect(() => {
    setPage(0);
  }, [tab]);

  function toggleCreatePage(type = "stake") {
    setCreateRequestType(type);
    setShowCreateRequest(!showCreateRequest);
  }

  function updateVoteSuccess(status, proposalId) {
    // Invalidate the proposals cache
    invalidateCategory();
    setVoteProposalId(proposalId);
    setToastStatus(status);
  }

  async function checkProposalStatus(proposalId) {
    try {
      const result = await Near.view(treasuryDaoID, "get_proposal", {
        id: proposalId,
      });
      updateVoteSuccess(result.status, proposalId);
    } catch {
      // deleted request (thus proposal won't exist)
      updateVoteSuccess("Removed", proposalId);
    }
  }

  // Handle transaction hashes from redirects
  useEffect(() => {
    const transactionHashes = searchParams.get("transactionHashes");
    if (transactionHashes && accountId) {
      fetch(process.env.NEXT_PUBLIC_RPC_URL || "https://rpc.mainnet.near.org", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: "dontcare",
          method: "tx",
          params: [transactionHashes, accountId],
        }),
      })
        .then((response) => response.json())
        .then((transaction) => {
          if (transaction !== null) {
            const transaction_method_name =
              transaction?.result?.transaction?.actions[0]?.FunctionCall
                ?.method_name;

            if (transaction_method_name === "act_proposal") {
              const args =
                transaction?.result?.transaction?.actions[0]?.FunctionCall
                  ?.args;
              const decodedArgs = JSON.parse(atob(args ?? "") ?? "{}");
              if (decodedArgs.id) {
                const proposalId = decodedArgs.id;
                checkProposalStatus(proposalId);
              }
            } else if (transaction_method_name === "add_proposal") {
              const description =
                transaction?.result?.transaction?.actions[0]?.FunctionCall
                  ?.args;
              const decodedDescription = JSON.parse(
                atob(description ?? "") ?? "{}"
              );
              const proposalId = atob(transaction.result.status.SuccessValue);
              setVoteProposalId(proposalId);

              // Determine toast message based on description
              if (
                decodedDescription?.proposal?.description?.includes("withdraw")
              ) {
                setToastStatus("WithdrawProposalAdded");
              } else if (
                decodedDescription?.proposal?.description?.includes("unstake")
              ) {
                setToastStatus("UnstakeProposalAdded");
              } else {
                setToastStatus("StakeProposalAdded");
              }
              invalidateCategory();
            }
          }
        })
        .catch((error) => {
          console.error("Error checking transaction:", error);
        });
    }
  }, [searchParams, accountId, treasuryDaoID]);

  const handleSortClick = () => {
    const newDirection = sortDirection === "desc" ? "asc" : "desc";
    setSortDirection(newDirection);
  };

  const ToastStatusContent = () => {
    let content = "";
    switch (showToastStatus) {
      case "InProgress":
        content =
          "Your vote is counted" +
          (typeof proposalDetailsPageId === "number"
            ? "."
            : ", the request is highlighted.");
        break;
      case "Approved":
        content = "The request has been successfully executed.";
        break;
      case "Rejected":
        content = "The request has been rejected.";
        break;
      case "Removed":
        content = "The request has been successfully deleted.";
        break;
      case "StakeProposalAdded":
        content = "Stake request has been successfully created.";
        break;
      case "UnstakeProposalAdded":
        content = "Unstake request has been successfully created.";
        break;
      case "WithdrawProposalAdded":
        content = "Withdraw request has been successfully created.";
        break;
      case "ErrorAddingProposal":
        content = "Failed to create request.";
        break;
      default:
        content = `The request has ${showToastStatus}.`;
        break;
    }
    return (
      <div className="toast-body">
        <div className="d-flex align-items-center gap-3">
          {showToastStatus === "Approved" && (
            <i className="bi bi-check2 mb-0 success-icon"></i>
          )}
          <div>
            {content}
            <br />
            {(showToastStatus === "StakeProposalAdded" ||
              showToastStatus === "UnstakeProposalAdded" ||
              showToastStatus === "WithdrawProposalAdded") && (
              <a
                className="text-underline cursor-pointer"
                onClick={() => {
                  const params = new URLSearchParams(searchParams);
                  params.set("id", voteProposalId);
                  router.push(`?${params.toString()}`);
                }}
              >
                View Request
              </a>
            )}
            {showToastStatus !== "InProgress" &&
              showToastStatus !== "Removed" &&
              showToastStatus !== "StakeProposalAdded" &&
              showToastStatus !== "UnstakeProposalAdded" &&
              showToastStatus !== "WithdrawProposalAdded" &&
              typeof proposalDetailsPageId !== "number" &&
              showToastStatus !== "ErrorAddingProposal" && (
                <a
                  className="text-underline cursor-pointer"
                  onClick={() => {
                    const params = new URLSearchParams(searchParams);
                    params.set("id", voteProposalId);
                    router.push(`?${params.toString()}`);
                  }}
                >
                  View in History
                </a>
              )}
          </div>
        </div>
      </div>
    );
  };

  const VoteSuccessToast = () => {
    return showToastStatus ? (
      <div className="toast-container position-fixed bottom-0 end-0 p-3">
        <div className={`toast ${showToastStatus ? "show" : ""}`}>
          <div className="toast-header px-2">
            <strong className="me-auto">Just Now</strong>
            <i
              className="bi bi-x-lg h6 mb-0 cursor-pointer"
              onClick={() => setToastStatus(null)}
            ></i>
          </div>
          <ToastStatusContent />
        </div>
      </div>
    ) : null;
  };

  const getCreateRequestTitle = () => {
    switch (createRequestType) {
      case "unstake":
        return "Create Unstake Request";
      case "withdraw":
        return "Create Withdraw Request";
      default:
        return "Create Stake Request";
    }
  };

  const renderCreateComponent = () => {
    const commonProps = {
      onCloseCanvas: () => setShowCreateRequest(false),
      setToastStatus,
      setVoteProposalId,
    };

    switch (createRequestType) {
      case "unstake":
        return <CreateUnstakeRequest {...commonProps} />;
      case "withdraw":
        return <CreateWithdrawRequest {...commonProps} />;
      default:
        return <CreateStakeRequest {...commonProps} />;
    }
  };

  return (
    <div className="w-100 h-100 flex-grow-1 d-flex flex-column">
      <VoteSuccessToast />
      {typeof proposalDetailsPageId === "number" ? (
        <div className="mt-4">
          <ProposalDetailsPage
            id={proposalDetailsPageId}
            setToastStatus={setToastStatus}
            setVoteProposalId={setVoteProposalId}
            currentTab={currentTab}
          />
        </div>
      ) : (
        <div className="h-100 w-100 flex-grow-1 d-flex flex-column">
          <OffCanvas
            showCanvas={showCreateRequest}
            onClose={() => setShowCreateRequest(false)}
            title={getCreateRequestTitle()}
          >
            {renderCreateComponent()}
          </OffCanvas>

          <div className="layout-flex-wrap flex-grow-1 align-items-start">
            <div className="layout-main">
              <div className="card py-3 d-flex flex-column w-100 h-100 flex-grow-1">
                {/* Sidebar Menu */}
                <div>
                  {/* Tabs */}
                  <div
                    className="d-flex justify-content-between border-bottom gap-2 align-items-center flex-wrap flex-md-nowrap"
                    style={{ paddingRight: "10px" }}
                  >
                    <ul className="custom-tabs nav gap-2 flex-shrink-0">
                      {[
                        { title: "Pending Requests" },
                        { title: "History" },
                      ].map(
                        ({ title }) =>
                          title && (
                            <li key={title}>
                              <div
                                onClick={() => {
                                  // Update URL params
                                  const params = new URLSearchParams(
                                    searchParams
                                  );
                                  params.set("tab", normalize(title));
                                  router.push(`?${params.toString()}`);
                                  // Clear filters when switching tabs
                                  setActiveFilters({});
                                  setAmountValues({
                                    min: "",
                                    max: "",
                                    equal: "",
                                    value: "between",
                                  });
                                  setSearch("");
                                  setShowFilters(false);
                                }}
                                className={[
                                  "d-inline-flex gap-2 nav-link",
                                  normalize(currentTab.title) ===
                                  normalize(title)
                                    ? "active"
                                    : "",
                                ].join(" ")}
                              >
                                <span>{title}</span>
                              </div>
                            </li>
                          )
                      )}
                    </ul>

                    <div className="d-flex gap-2 align-items-center flex-wrap flex-sm-nowrap pb-2 pb-md-0 ps-2 ps-md-0 flex-grow-1 justify-content-start justify-content-md-end">
                      {/* Search and Filters */}
                      <div className="input-responsive">
                        <div className="input-group flex-grow-1">
                          <span className="input-group-text bg-transparent">
                            <i className="bi bi-search text-secondary"></i>
                          </span>
                          <input
                            type="text"
                            className={`form-control border-start-0 ${
                              search ? "border-end-0" : ""
                            }`}
                            placeholder={
                              isSearchFocused ? "Search by id, notes" : "Search"
                            }
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            onFocus={() => setIsSearchFocused(true)}
                            onBlur={() => setIsSearchFocused(false)}
                          />
                          {search && (
                            <span className="input-group-text bg-transparent border-start-0">
                              <i
                                className="bi bi-x-lg cursor-pointer text-secondary"
                                onClick={() => setSearch("")}
                              ></i>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Export button for History tab */}
                      {currentTab.title === "History" && (
                        <div style={{ minWidth: "fit-content" }}>
                          <ExportTransactions
                            page="stake-delegation"
                            activeFilters={activeFilters}
                            amountValues={amountValues}
                            search={search}
                          />
                        </div>
                      )}

                      <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={`btn btn-outline-secondary ${
                          showFilters ||
                          Object.keys(activeFilters ?? {}).length > 0
                            ? "active-filter"
                            : ""
                        }`}
                      >
                        <i className="bi bi-funnel"></i>
                      </button>

                      <SettingsDropdown
                        page="stake-delegation"
                        isPendingPage={currentTab.title === "Pending Requests"}
                      />

                      {hasCreatePermission && (
                        <div
                          className="dropdown"
                          style={{ minWidth: "fit-content" }}
                        >
                          <button
                            className="btn primary-button d-flex align-items-center gap-2 mb-0 dropdown-toggle"
                            type="button"
                            data-bs-toggle="dropdown"
                          >
                            <i className="bi bi-plus-lg h5 mb-0"></i>
                            <span className="responsive-text">
                              Create Request
                            </span>
                          </button>
                          <ul className="dropdown-menu dropdown-menu-end">
                            <li>
                              <a
                                className="dropdown-item cursor-pointer d-flex align-items-center gap-2"
                                onClick={() => toggleCreatePage("stake")}
                              >
                                <StakeIcon width={16} height={16} />
                                Stake
                              </a>
                            </li>
                            <li>
                              <a
                                className="dropdown-item cursor-pointer d-flex align-items-center gap-2"
                                onClick={() => toggleCreatePage("unstake")}
                              >
                                <UnstakeIcon width={16} height={16} />
                                Unstake
                              </a>
                            </li>
                            <li>
                              <a
                                className="dropdown-item cursor-pointer d-flex align-items-center gap-2"
                                onClick={() => toggleCreatePage("withdraw")}
                              >
                                <WithdrawIcon width={16} height={16} />
                                Withdraw
                              </a>
                            </li>
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                  {showFilters && (
                    <div className="border-bottom">
                      <Filters
                        isPendingRequests={
                          currentTab.title === "Pending Requests"
                        }
                        activeFilters={activeFilters}
                        setActiveFilters={setActiveFilters}
                        amountValues={amountValues}
                        setAmountValues={setAmountValues}
                        setShowFilters={setShowFilters}
                      />
                    </div>
                  )}
                </div>

                {/* Content */}
                <Table
                  proposals={proposals}
                  isPendingRequests={currentTab.title === "Pending Requests"}
                  loading={isLoading}
                  sortDirection={sortDirection}
                  handleSortClick={handleSortClick}
                  onSelectRequest={(id) => setShowProposalId(id)}
                  highlightProposalId={voteProposalId}
                  setToastStatus={setToastStatus}
                  setVoteProposalId={setVoteProposalId}
                  selectedProposalDetailsId={showProposalDetailsId}
                  refreshTableData={() => invalidateCategory()}
                />

                {(proposals ?? [])?.length > 0 && (
                  <Pagination
                    totalLength={totalLength}
                    totalPages={Math.ceil(totalLength / rowsPerPage)}
                    onNextClick={() => setPage(page + 1)}
                    onPrevClick={() => setPage(page - 1)}
                    currentPage={page}
                    rowsPerPage={rowsPerPage}
                    onRowsChange={(v) => {
                      setPage(0);
                      setRowsPerPage(parseInt(v));
                    }}
                  />
                )}
              </div>
            </div>
            <div
              className={`layout-secondary ${
                typeof showProposalDetailsId === "number" ? "show" : ""
              }`}
            >
              {typeof showProposalDetailsId === "number" && (
                <ProposalDetailsPage
                  id={showProposalDetailsId}
                  isCompactVersion={true}
                  onClose={() => setShowProposalId(null)}
                  setToastStatus={setToastStatus}
                  setVoteProposalId={setVoteProposalId}
                  currentTab={currentTab}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StakeDelegation;
