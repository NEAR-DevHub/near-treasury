"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useNearWallet } from "@/context/NearWalletContext";
import { useDao } from "@/context/DaoContext";
import { useProposals } from "@/hooks/useProposals";
import { Near } from "@/api/near";
import { normalize } from "@/helpers/formatters";
import OffCanvas from "@/components/ui/OffCanvas";
import SettingsDropdown from "@/components/dropdowns/SettingsDropdown";
import InsufficientBannerModal from "@/components/proposals/InsufficientBannerModal";
import ExportTransactions from "@/components/proposals/ExportTransactions";
import Pagination from "@/components/ui/Pagination";
import Table from "./Table";
import ProposalDetailsPage from "./ProposalDetailsPage";
import CreateAssetExchangeRequest from "./CreateAssetExchangeRequest";

const AssetExchangeIndex = () => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { accountId } = useNearWallet();
  const { hasPermission } = useDao();

  const tab = searchParams.get("tab");
  const id = searchParams.get("id");

  const [showCreateRequest, setShowCreateRequest] = useState(false);
  const [showProposalDetailsId, setShowProposalId] = useState(null);
  const [showToastStatus, setToastStatus] = useState(false);
  const [voteProposalId, setVoteProposalId] = useState(null);

  const currentTab = useMemo(
    () => ({
      title: tab === "history" ? "History" : "Pending Requests",
    }),
    [tab]
  );

  const hasCreatePermission = hasPermission?.("call", "AddProposal");

  const [sortDirection, setSortDirection] = useState("desc");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const statuses = useMemo(
    () =>
      currentTab.title === "Pending Requests"
        ? ["InProgress"]
        : ["Approved", "Rejected", "Expired", "Failed"],
    [currentTab.title]
  );

  const {
    proposals,
    total: totalLength,
    isLoading,
    invalidateCategory,
  } = useProposals({
    category: "asset-exchange",
    statuses,
    page,
    pageSize: rowsPerPage,
    sortDirection,
  });

  const proposalDetailsPageId = useMemo(
    () => (id || id === "0" || id === 0 ? parseInt(id) : null),
    [id]
  );

  // Reset page when tab changes
  useEffect(() => {
    setPage(0);
  }, [tab]);

  const toggleCreatePage = useCallback(() => {
    setShowCreateRequest((prev) => !prev);
  }, []);

  const updateVoteSuccess = useCallback(
    (status, proposalId) => {
      invalidateCategory();
      setVoteProposalId(proposalId);
      setToastStatus(status);
    },
    [invalidateCategory]
  );

  const checkProposalStatus = useCallback(
    async (proposalId) => {
      try {
        const result = await Near.view(
          (typeof window !== "undefined" && window?.treasuryDaoID) || "",
          "get_proposal",
          { id: proposalId }
        );
        updateVoteSuccess(result.status, proposalId);
      } catch {
        updateVoteSuccess("Removed", proposalId);
      }
    },
    [updateVoteSuccess]
  );

  useEffect(() => {
    const transactionHashes = searchParams.get("transactionHashes");
    if (transactionHashes && accountId) {
      fetch(process.env.NEXT_PUBLIC_RPC_URL || "https://rpc.mainnet.near.org", {
        method: "POST",
        headers: { "content-type": "application/json" },
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
        .catch(() => {});
    }
  }, [searchParams, accountId]);

  const handleSortClick = useCallback(() => {
    setSortDirection((prev) => (prev === "desc" ? "asc" : "desc"));
  }, []);

  const handleCloseProposalDetails = useCallback(() => {
    setShowProposalId(null);
  }, []);

  const handleOpenCreateRequest = useCallback(() => {
    setShowCreateRequest(true);
  }, []);

  const handleSelectRequest = useCallback((id) => {
    setShowProposalId(id);
  }, []);

  const ActionButtonComponent = useCallback(
    () => (
      <button className="btn primary-button d-flex align-items-center gap-2 mb-0">
        <i className="bi bi-plus-lg h5 mb-0"></i>
        <span className="responsive-text">Create Request</span>
      </button>
    ),
    []
  );

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
      case "ProposalAdded":
        content = "Asset exchange request has been successfully created.";
        break;
      case "ErrorAddingProposal":
        content = "Failed to create asset exchange request.";
        break;
      default:
        content = `The request is ${showToastStatus}.`;
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
            title={"Create Asset Exchange Request"}
          >
            <CreateAssetExchangeRequest
              onCloseCanvas={toggleCreatePage}
              setToastStatus={setToastStatus}
              setVoteProposalId={setVoteProposalId}
            />
          </OffCanvas>

          <div className="layout-flex-wrap flex-grow-1 align-items-start">
            <div className="layout-main">
              <div className="card py-3 d-flex flex-column w-100 h-100 flex-grow-1">
                <div>
                  <div
                    className="d-flex justify-content-between border-bottom gap-2 align-items-center flex-wrap flex-md-nowrap"
                    style={{ paddingRight: "10px" }}
                  >
                    <ul className="custom-tabs nav gap-2 flex-shrink-0">
                      {[
                        { title: "Pending Requests" },
                        { title: "History" },
                      ].map(({ title }) => (
                        <li key={title}>
                          <div
                            onClick={() => {
                              const params = new URLSearchParams(searchParams);
                              params.set("tab", normalize(title));
                              router.push(`?${params.toString()}`);
                            }}
                            className={[
                              "d-inline-flex gap-2 nav-link",
                              normalize(currentTab.title) === normalize(title)
                                ? "active"
                                : "",
                            ].join(" ")}
                          >
                            <span>{title}</span>
                          </div>
                        </li>
                      ))}
                    </ul>

                    <div className="d-flex gap-2 align-items-center flex-wrap flex-sm-nowrap pb-2 pb-md-0 ps-2 ps-md-0 flex-grow-1 justify-content-start justify-content-md-end">
                      {currentTab.title === "History" && (
                        <div style={{ minWidth: "fit-content" }}>
                          <ExportTransactions page="asset-exchange" />
                        </div>
                      )}
                      <SettingsDropdown
                        page="asset-exchange"
                        isPendingPage={currentTab.title === "Pending Requests"}
                      />

                      {hasCreatePermission && (
                        <div style={{ minWidth: "fit-content" }}>
                          <InsufficientBannerModal
                            ActionButton={ActionButtonComponent}
                            checkForDeposit={true}
                            callbackAction={handleOpenCreateRequest}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <Table
                  proposals={proposals}
                  isPendingRequests={currentTab.title === "Pending Requests"}
                  loading={isLoading}
                  onSelectRequest={handleSelectRequest}
                  highlightProposalId={voteProposalId}
                  setToastStatus={setToastStatus}
                  setVoteProposalId={setVoteProposalId}
                  selectedProposalDetailsId={showProposalDetailsId}
                  refreshTableData={invalidateCategory}
                  handleSortClick={handleSortClick}
                  sortDirection={sortDirection}
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
                  onClose={handleCloseProposalDetails}
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

export default AssetExchangeIndex;
