"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useNearWallet } from "@/context/NearWalletContext";
import { useDao } from "@/context/DaoContext";
import { useProposals } from "@/hooks/useProposals";
import { Near } from "@/api/near";
import { normalize } from "@/helpers/formatters";
import Table from "@/app/[daoId]/function-call/Table";
import ProposalDetailsPage from "@/app/[daoId]/function-call/ProposalDetailsPage";
import CreateCustomFunctionCallRequest from "@/app/[daoId]/function-call/CreateCustomFunctionCallRequest";
import ExportTransactions from "@/components/proposals/ExportTransactions";
import OffCanvas from "@/components/ui/OffCanvas";
import Pagination from "@/components/ui/Pagination";
import SettingsDropdown from "@/components/dropdowns/SettingsDropdown";
import InsufficientBannerModal from "@/components/proposals/InsufficientBannerModal";

const FunctionCall = () => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { accountId } = useNearWallet();
  const { daoId: treasuryDaoID, hasPermission } = useDao();

  const tab = searchParams.get("tab");
  const id = searchParams.get("id");

  const [showCreateRequest, setShowCreateRequest] = useState(false);
  const [showProposalDetailsId, setShowProposalDetailsId] = useState(null);
  const [showToastStatus, setToastStatus] = useState(false);
  const [voteProposalId, setVoteProposalId] = useState(null);
  // Derive current tab from URL
  const currentTab = {
    title: tab === "history" ? "History" : "Pending Requests",
  };
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [sortDirection, setSortDirection] = useState("desc");
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  const proposalDetailsPageId =
    id || id === "0" || id === 0 ? parseInt(id) : null;

  const hasCreatePermission = hasPermission?.("call", "AddProposal");

  // Use the proposals hook
  const {
    proposals,
    total: totalLength,
    isLoading,
    invalidateCategory,
  } = useProposals({
    daoId: treasuryDaoID,
    proposalType: ["FunctionCall"],
    statuses:
      currentTab.title === "Pending Requests"
        ? ["InProgress"]
        : ["Approved", "Rejected", "Expired", "Failed"],
    page,
    pageSize: rowsPerPage,
    sortDirection,
    search,
  });

  // Reset page when tab changes
  useEffect(() => {
    setPage(0);
  }, [tab]);

  function toggleCreatePage() {
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
              const proposalId = atob(transaction.result.status.SuccessValue);
              setVoteProposalId(proposalId);
              setToastStatus("ProposalAdded");
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
            : ", the function call request is highlighted.");
        break;
      case "Approved":
        content = "The function call request has been successfully executed.";
        break;
      case "Rejected":
        content = "The function call request has been rejected.";
        break;
      case "Removed":
        content = "The function call request has been successfully deleted.";
        break;
      case "ProposalAdded":
        content = "Function call request has been successfully created.";
        break;
      case "ErrorAddingProposal":
        content = "Failed to create function call request.";
        break;
      default:
        content = `The function call request is ${showToastStatus}.`;
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
            {showToastStatus === "ProposalAdded" && (
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
              showToastStatus !== "ProposalAdded" &&
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
            onClose={toggleCreatePage}
            title="Create Function Call Request"
          >
            <CreateCustomFunctionCallRequest
              onCloseCanvas={toggleCreatePage}
              setToastStatus={setToastStatus}
              setVoteProposalId={setVoteProposalId}
            />
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
                                  setSearch("");
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
                      {/* Search */}
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
                            page="function-call"
                            activeFilters={{}}
                            amountValues={{}}
                            search={search}
                          />
                        </div>
                      )}

                      <SettingsDropdown
                        page="function-call"
                        isPendingPage={currentTab.title === "Pending Requests"}
                      />

                      {hasCreatePermission && (
                        <div style={{ minWidth: "fit-content" }}>
                          <InsufficientBannerModal
                            ActionButton={() => (
                              <button className="btn primary-button d-flex align-items-center gap-2 mb-0">
                                <i className="bi bi-plus-lg h5 mb-0"></i>
                                <span className="responsive-text">
                                  Create Request
                                </span>
                              </button>
                            )}
                            checkForDeposit={true}
                            callbackAction={() => setShowCreateRequest(true)}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Content */}
                <Table
                  proposals={proposals}
                  isPendingRequests={currentTab.title === "Pending Requests"}
                  loading={isLoading}
                  sortDirection={sortDirection}
                  handleSortClick={handleSortClick}
                  onSelectRequest={(id) => setShowProposalDetailsId(id)}
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
                  onClose={() => setShowProposalDetailsId(null)}
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

export default FunctionCall;
